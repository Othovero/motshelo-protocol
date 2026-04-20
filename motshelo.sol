// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

/*
    Motshelo Protocol V2 — Aave V3 Yield Integration on BSC

    Revenue model: 0% deposit fee, 2% withdrawal fee on principal,
    60/40 yield split (protocol/user) on Aave V3 interest.

    Target token: USDT (BEP-20, 18 decimals).

    Deployment order (circular dependency resolution):
    1. Deploy FeeCollector with a temporary factory address (e.g. deployer).
    2. Deploy MotsheloFactory with FeeCollector address + Aave V3 config.
    3. Call FeeCollector.updateFactory(factoryAddress).
    4. Deploy MotsheloRegistry with factoryAddress.
    5. Deploy MotsheloNFT with factoryAddress.
    6. Call Factory.updateDependencies(feeCollector, nftAddress, registryAddress).
    7. Call Factory.setApprovedToken(USDT_BSC_ADDRESS, true).
    8. Fund Chainlink VRF subscription and add Factory as consumer.

    BSC Mainnet Addresses:
    - Aave V3 Pool (BSC):   0x6807dc960D6d17351D069670733D59634f9c169B
    - USDT (BEP-20):        0x55d398326f99059fF775485246999027b3197955
    - aUSDT (aToken):       0xf6C6361958652d87e07b46187513575975a6c016
*/

interface IFeeCollector {
    function receiveFees(address token, uint256 amount) external;
}

interface IMotsheloNFT {
    function mint(address to, address circle) external returns (uint256);
}

interface IMotsheloRegistry {
    function registerCircle(
        address circle,
        string calldata name,
        string calldata description,
        string calldata imageUri
    ) external;
}

interface ICircleFactory {
    function isDeployedCircle(address circle) external view returns (bool);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

contract MotsheloCircle is ReentrancyGuard, VRFConsumerBaseV2 {
    using SafeERC20 for IERC20;

    enum CircleType { ROTATION, SAVINGS_SPLIT }
    enum CircleStatus { OPEN, ACTIVE, COMPLETED, PAUSED }
    enum PayoutOrder { FIXED, RANDOM, SENIORITY }
    enum SplitMethod { PROPORTIONAL, EQUAL }
    enum MissPolicy { SKIP, SLASH, EXPEL }
    enum JoinVisibility { PUBLIC, INVITE_ONLY, WHITELIST }

    struct MemberData {
        bool isActive;
        uint256 joinedAt;
        uint256 rotationPosition;
        bool hasReceived;
        uint256 contributed;
        uint256 missedContributions;
        uint256 lastContributionAt;
        address referrer;
        uint256 consecutiveMisses;
    }

    struct CircleConfig {
        CircleType circleType;
        uint256 contributionAmount;
        uint256 contributionFrequency;
        uint256 maxMembers;
        uint256 minMembersToActivate;
        PayoutOrder payoutOrder;
        SplitMethod splitMethod;
        MissPolicy missPolicy;
        uint256 gracePeriod;
        bool earlyExitAllowed;
        uint256 maturityTimestamp;
        uint256 communityReserveBps;
        JoinVisibility joinVisibility;
    }

    uint256 public constant WITHDRAWAL_FEE_BPS = 200;
    uint256 public constant PROTOCOL_YIELD_BPS = 6000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MIN_CONTRIBUTION = 10e18;
    uint256 public constant MAX_CONTRIBUTION = 1000000e18;
    uint256 public constant MIN_MEMBERS = 2;
    uint256 public constant MAX_MEMBERS = 50;
    uint256 public constant SLASH_PERCENTAGE = 1000;
    uint256 public constant WEEKLY = 604800;
    uint256 public constant MONTHLY = 2592000;
    uint256 public constant GRACE_12H = 43200;
    uint256 public constant GRACE_24H = 86400;
    uint256 public constant GRACE_48H = 172800;
    uint256 public constant GRACE_72H = 259200;

    address public immutable creator;
    IERC20 public immutable token;
    address public immutable feeCollector;
    address public immutable nftContract;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 public immutable vrfKeyHash;
    uint64 public immutable vrfSubscriptionId;
    IPool public immutable aavePool;
    IERC20 public immutable aToken;

    CircleType public circleType;
    uint256 public contributionAmount;
    uint256 public contributionFrequency;
    uint256 public maxMembers;
    uint256 public minMembersToActivate;
    PayoutOrder public payoutOrder;
    SplitMethod public splitMethod;
    MissPolicy public missPolicy;
    uint256 public gracePeriod;
    bool public earlyExitAllowed;
    uint256 public maturityTimestamp;
    uint256 public communityReserveBps;
    JoinVisibility public joinVisibility;

    CircleStatus public status;
    CircleStatus private _prePauseStatus;
    address[] public members;
    mapping(address => MemberData) public memberData;
    mapping(address => bool) public whitelist;
    uint256 public currentRound;
    uint256 public totalDeposited;
    uint256 public totalPrincipal;
    uint256 public accumulatedFees;
    uint256 public roundStartTimestamp;
    uint256 public activatedAt;
    uint256 public netContributionsThisRound;
    mapping(uint256 => address) public rotationOrder;
    uint256 public rotationSize;
    uint256 public contributionsThisRound;
    uint256 public vrfRequestId;
    bool public vrfFulfilled;

    event CircleCreated(address indexed circle, address indexed creator, CircleType cType);
    event MemberJoined(address indexed circle, address indexed member, uint256 position);
    event CircleActivated(address indexed circle, uint256 memberCount);
    event ContributionMade(address indexed circle, address indexed member, uint256 amount, uint256 round);
    event PayoutSent(address indexed circle, address indexed recipient, uint256 amount, uint256 round);
    event SplitExecuted(address indexed circle, uint256 totalDistributed, uint256 memberCount);
    event MemberExited(address indexed circle, address indexed member, uint256 refundAmount);
    event MissPenaltyApplied(address indexed circle, address indexed member, MissPolicy policy);
    event FeesCollected(address indexed circle, uint256 amount);
    event BadgeMinted(address indexed member, uint256 tokenId, address indexed circle);
    event WhitelistUpdated(address indexed member, bool added);
    event RoundAdvanced(address indexed circle, uint256 newRound);
    event CirclePaused(address indexed circle);
    event CircleUnpaused(address indexed circle);
    event YieldHarvested(address indexed circle, uint256 totalYield, uint256 protocolShare, uint256 userShare);
    event AaveSupplied(address indexed circle, uint256 amount);
    event AaveWithdrawn(address indexed circle, uint256 amount);

    error CircleNotOpen();
    error CircleNotActive();
    error CirclePausedError();
    error AlreadyMember();
    error NotMember();
    error MaxMembersReached();
    error NotWhitelisted();
    error InsufficientMembers();
    error OnlyCreator();
    error NotInContributionWindow();
    error AlreadyContributedThisRound();
    error NotAllMembersContributed();
    error AlreadyReceivedPayout();
    error MaturityNotReached();
    error EarlyExitNotAllowed();
    error InvalidConfiguration();
    error GracePeriodNotExpired();
    error MemberNotMissed();
    error CircleCompleted();
    error RandomOrderNotReady();
    error InvalidAddress();

    modifier onlyCreator() {
        if (msg.sender != creator) revert OnlyCreator();
        _;
    }

    modifier onlyWhenOpen() {
        if (status != CircleStatus.OPEN) revert CircleNotOpen();
        _;
    }

    modifier onlyWhenActive() {
        if (status != CircleStatus.ACTIVE) revert CircleNotActive();
        _;
    }

    modifier onlyWhenLive() {
        if (status != CircleStatus.ACTIVE && status != CircleStatus.PAUSED) revert CircleNotActive();
        _;
    }

    modifier whenNotPaused() {
        if (status == CircleStatus.PAUSED) revert CirclePausedError();
        _;
    }

    modifier onlyMember() {
        if (!memberData[msg.sender].isActive) revert NotMember();
        _;
    }

    constructor(
        address _creator,
        address _token,
        address _feeCollector,
        address _nftContract,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint64 _vrfSubscriptionId,
        address _aavePool,
        address _aToken,
        CircleConfig memory _config
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        if (
            _creator == address(0) || _token == address(0) ||
            _feeCollector == address(0) || _vrfCoordinator == address(0) ||
            _aavePool == address(0) || _aToken == address(0)
        ) {
            revert InvalidAddress();
        }
        _validateConfig(_config);

        creator = _creator;
        token = IERC20(_token);
        feeCollector = _feeCollector;
        nftContract = _nftContract;
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        vrfKeyHash = _vrfKeyHash;
        vrfSubscriptionId = _vrfSubscriptionId;
        aavePool = IPool(_aavePool);
        aToken = IERC20(_aToken);

        circleType = _config.circleType;
        contributionAmount = _config.contributionAmount;
        contributionFrequency = _config.contributionFrequency;
        maxMembers = _config.maxMembers;
        minMembersToActivate = _config.minMembersToActivate;
        payoutOrder = _config.payoutOrder;
        splitMethod = _config.splitMethod;
        missPolicy = _config.missPolicy;
        gracePeriod = _config.gracePeriod;
        earlyExitAllowed = _config.earlyExitAllowed;
        maturityTimestamp = _config.maturityTimestamp;
        communityReserveBps = _config.communityReserveBps;
        joinVisibility = _config.joinVisibility;

        status = CircleStatus.OPEN;
        currentRound = 0;
        emit CircleCreated(address(this), _creator, _config.circleType);
    }

    // ──────────────────────── V2: Aave Helpers ────────────────────────

    function getAccruedYield() public view returns (uint256) {
        uint256 currentBalance = aToken.balanceOf(address(this));
        if (currentBalance <= totalPrincipal) return 0;
        return currentBalance - totalPrincipal;
    }

    function _supplyToAave(uint256 amount) internal {
        if (amount == 0) return;
        token.forceApprove(address(aavePool), amount);
        aavePool.supply(address(token), amount, address(this), 0);
        totalPrincipal += amount;
        emit AaveSupplied(address(this), amount);
    }

    function _withdrawFromAave(uint256 amount) internal returns (uint256) {
        if (amount == 0) return 0;
        uint256 withdrawn = aavePool.withdraw(address(token), amount, address(this));
        emit AaveWithdrawn(address(this), withdrawn);
        return withdrawn;
    }

    // ──────────────────────── Core Functions ────────────────────────

    function join(address referrer) external nonReentrant onlyWhenOpen {
        if (memberData[msg.sender].isActive) revert AlreadyMember();
        if (members.length >= maxMembers) revert MaxMembersReached();
        if (
            (joinVisibility == JoinVisibility.WHITELIST || joinVisibility == JoinVisibility.INVITE_ONLY)
            && !whitelist[msg.sender]
        ) revert NotWhitelisted();

        uint256 amount = contributionAmount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        _supplyToAave(amount);

        uint256 position = members.length;
        members.push(msg.sender);
        memberData[msg.sender] = MemberData({
            isActive: true,
            joinedAt: block.timestamp,
            rotationPosition: position,
            hasReceived: false,
            contributed: amount,
            missedContributions: 0,
            lastContributionAt: 0,
            referrer: referrer,
            consecutiveMisses: 0
        });

        rotationOrder[position] = msg.sender;
        totalDeposited += amount;
        emit MemberJoined(address(this), msg.sender, position);
    }

    function activate() external onlyCreator onlyWhenOpen {
        if (members.length < minMembersToActivate) revert InsufficientMembers();

        rotationSize = members.length;

        if (payoutOrder == PayoutOrder.RANDOM) {
            _requestRandomOrder();
        } else {
            vrfFulfilled = true;
        }

        status = CircleStatus.ACTIVE;
        activatedAt = block.timestamp;
        roundStartTimestamp = block.timestamp;
        currentRound = 1;
        contributionsThisRound = 0;
        netContributionsThisRound = 0;
        emit CircleActivated(address(this), members.length);
    }

    function contribute() external nonReentrant onlyWhenActive whenNotPaused onlyMember {
        MemberData storage member = memberData[msg.sender];
        if (!_isInContributionWindow()) revert NotInContributionWindow();
        if (member.lastContributionAt >= roundStartTimestamp) revert AlreadyContributedThisRound();

        uint256 amount = contributionAmount;

        token.safeTransferFrom(msg.sender, address(this), amount);
        _supplyToAave(amount);

        member.contributed += amount;
        member.lastContributionAt = block.timestamp;
        member.consecutiveMisses = 0;
        totalDeposited += amount;
        contributionsThisRound++;
        netContributionsThisRound += amount;

        emit ContributionMade(address(this), msg.sender, amount, currentRound);
    }

    function triggerPayout() external nonReentrant onlyWhenActive whenNotPaused {
        if (circleType != CircleType.ROTATION) revert InvalidConfiguration();
        if (currentRound > rotationSize) revert CircleCompleted();
        if (payoutOrder == PayoutOrder.RANDOM && !vrfFulfilled) revert RandomOrderNotReady();

        uint256 activeMembers = _countActiveMembers();
        if (contributionsThisRound < activeMembers) revert NotAllMembersContributed();

        address recipient = rotationOrder[currentRound - 1];
        MemberData storage recipientData = memberData[recipient];

        if (!recipientData.isActive) {
            currentRound++;
            emit RoundAdvanced(address(this), currentRound);
            if (currentRound > rotationSize) {
                _completeCircle();
            }
            return;
        }
        if (recipientData.hasReceived) revert AlreadyReceivedPayout();

        uint256 grossPot = netContributionsThisRound;

        uint256 yield = getAccruedYield();
        uint256 protocolYieldShare = (yield * PROTOCOL_YIELD_BPS) / BPS_DENOMINATOR;
        uint256 userYieldShare = yield - protocolYieldShare;

        uint256 wFee = (grossPot * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 communityReserve = (grossPot * communityReserveBps) / BPS_DENOMINATOR;
        uint256 netPayout = grossPot - wFee - communityReserve + userYieldShare;

        _withdrawFromAave(grossPot + yield);
        totalPrincipal -= grossPot;

        accumulatedFees += (wFee + communityReserve + protocolYieldShare);
        recipientData.hasReceived = true;
        token.safeTransfer(recipient, netPayout);
        _flushFees();

        emit YieldHarvested(address(this), yield, protocolYieldShare, userYieldShare);
        emit PayoutSent(address(this), recipient, netPayout, currentRound);

        if (currentRound >= rotationSize) {
            _completeCircle();
        } else {
            _advanceRound();
        }
    }

    function triggerSplit() external nonReentrant onlyWhenActive whenNotPaused {
        if (circleType != CircleType.SAVINGS_SPLIT) revert InvalidConfiguration();
        if (block.timestamp < maturityTimestamp) revert MaturityNotReached();

        uint256 yield = getAccruedYield();
        uint256 protocolYieldShare = (yield * PROTOCOL_YIELD_BPS) / BPS_DENOMINATOR;
        uint256 userYieldShare = yield - protocolYieldShare;

        _withdrawFromAave(type(uint256).max);
        totalPrincipal = 0;

        accumulatedFees += protocolYieldShare;

        uint256 distributablePool = token.balanceOf(address(this)) - accumulatedFees;
        uint256 activeCount = _countActiveMembers();
        uint256 totalDistributed = 0;
        if (activeCount == 0) revert InvalidConfiguration();
        if (splitMethod == SplitMethod.PROPORTIONAL && totalDeposited == 0) revert InvalidConfiguration();

        address lastActiveMember;
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            MemberData storage data = memberData[member];
            if (!data.isActive) continue;

            lastActiveMember = member;

            uint256 share = splitMethod == SplitMethod.PROPORTIONAL
                ? (distributablePool * data.contributed) / totalDeposited
                : (distributablePool / activeCount);

            uint256 wFee = (data.contributed * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 communityReserve = (data.contributed * communityReserveBps) / BPS_DENOMINATOR;
            uint256 netShare = share - wFee - communityReserve;

            accumulatedFees += (wFee + communityReserve);
            totalDistributed += netShare;
            token.safeTransfer(member, netShare);
            data.hasReceived = true;
        }

        _flushFees();

        uint256 remaining = token.balanceOf(address(this));
        if (remaining > 0 && lastActiveMember != address(0)) {
            token.safeTransfer(lastActiveMember, remaining);
            totalDistributed += remaining;
        }

        _completeCircle();
        emit YieldHarvested(address(this), yield, protocolYieldShare, userYieldShare);
        emit SplitExecuted(address(this), totalDistributed, activeCount);
    }

    // Members can exit while paused to avoid lock-in risk.
    // For ROTATION circles, only the join deposit (not round contributions already
    // paid out to recipients) is refundable. We cap refund to proportional share
    // of Aave balance to prevent insolvency.
    function exitEarly() external nonReentrant onlyWhenLive onlyMember {
        if (!earlyExitAllowed) revert EarlyExitNotAllowed();

        MemberData storage member = memberData[msg.sender];

        if (member.lastContributionAt >= roundStartTimestamp) {
            uint256 roundContribution = contributionAmount;
            if (netContributionsThisRound >= roundContribution) {
                netContributionsThisRound -= roundContribution;
            }
            if (contributionsThisRound > 0) {
                contributionsThisRound--;
            }
        }

        uint256 refundAmount = member.contributed;

        uint256 aaveBalance = aToken.balanceOf(address(this));
        if (refundAmount > aaveBalance) {
            refundAmount = aaveBalance;
        }

        uint256 memberYieldPortion = totalPrincipal > 0
            ? (getAccruedYield() * refundAmount) / totalPrincipal
            : 0;
        uint256 protocolYieldShare = (memberYieldPortion * PROTOCOL_YIELD_BPS) / BPS_DENOMINATOR;
        uint256 userYieldShare = memberYieldPortion - protocolYieldShare;

        _withdrawFromAave(refundAmount + memberYieldPortion);
        totalPrincipal -= refundAmount;

        uint256 fee = (refundAmount * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netRefund = refundAmount - fee + userYieldShare;

        accumulatedFees += (fee + protocolYieldShare);
        member.isActive = false;
        member.contributed = 0;
        totalDeposited = totalDeposited >= refundAmount ? totalDeposited - refundAmount : 0;
        _removeFromRotation(msg.sender);
        token.safeTransfer(msg.sender, netRefund);
        _flushFees();

        emit YieldHarvested(address(this), memberYieldPortion, protocolYieldShare, userYieldShare);
        emit MemberExited(address(this), msg.sender, netRefund);
    }

    function applyMissPenalty(address member) external nonReentrant onlyWhenActive {
        MemberData storage data = memberData[member];
        if (!data.isActive) revert NotMember();

        uint256 windowEnd = roundStartTimestamp + contributionFrequency + gracePeriod;
        if (block.timestamp <= windowEnd) revert GracePeriodNotExpired();
        if (data.lastContributionAt >= roundStartTimestamp) revert MemberNotMissed();

        data.missedContributions++;
        data.consecutiveMisses++;

        if (missPolicy == MissPolicy.SKIP) {
            if (!data.hasReceived) {
                _moveToEndOfQueue(member);
            }
        } else if (missPolicy == MissPolicy.SLASH) {
            uint256 slashAmount = (data.contributed * SLASH_PERCENTAGE) / BPS_DENOMINATOR;
            data.contributed -= slashAmount;
            _redistributeSlash(slashAmount, member);
        } else if (missPolicy == MissPolicy.EXPEL && data.consecutiveMisses >= 2) {
            _expelMember(member);
        }

        emit MissPenaltyApplied(address(this), member, missPolicy);
    }

    function pauseCircle() external onlyCreator {
        if (status != CircleStatus.ACTIVE) revert InvalidConfiguration();
        _prePauseStatus = status;
        status = CircleStatus.PAUSED;
        emit CirclePaused(address(this));
    }

    function unpauseCircle() external onlyCreator {
        if (status != CircleStatus.PAUSED) revert InvalidConfiguration();
        status = _prePauseStatus;
        emit CircleUnpaused(address(this));
    }

    function addToWhitelist(address[] calldata addresses) external onlyCreator onlyWhenOpen {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = true;
            emit WhitelistUpdated(addresses[i], true);
        }
    }

    function removeFromWhitelist(address[] calldata addresses) external onlyCreator onlyWhenOpen {
        for (uint256 i = 0; i < addresses.length; i++) {
            whitelist[addresses[i]] = false;
            emit WhitelistUpdated(addresses[i], false);
        }
    }

    // ──────────────────────── View Functions ────────────────────────

    function getMemberCount() external view returns (uint256) {
        return members.length;
    }

    function getActiveMembers() external view returns (address[] memory) {
        uint256 activeCount = _countActiveMembers();
        address[] memory activeList = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < members.length; i++) {
            if (memberData[members[i]].isActive) {
                activeList[index] = members[i];
                index++;
            }
        }
        return activeList;
    }

    function getMemberInfo(address member) external view returns (MemberData memory) {
        return memberData[member];
    }

    function getCircleConfig() external view returns (CircleConfig memory) {
        return CircleConfig({
            circleType: circleType,
            contributionAmount: contributionAmount,
            contributionFrequency: contributionFrequency,
            maxMembers: maxMembers,
            minMembersToActivate: minMembersToActivate,
            payoutOrder: payoutOrder,
            splitMethod: splitMethod,
            missPolicy: missPolicy,
            gracePeriod: gracePeriod,
            earlyExitAllowed: earlyExitAllowed,
            maturityTimestamp: maturityTimestamp,
            communityReserveBps: communityReserveBps,
            joinVisibility: joinVisibility
        });
    }

    function getCurrentRecipient() external view returns (address) {
        if (circleType != CircleType.ROTATION || currentRound == 0) return address(0);
        return rotationOrder[currentRound - 1];
    }

    function getContributionWindow() external view returns (uint256 start, uint256 end, uint256 graceEnd) {
        start = roundStartTimestamp;
        end = roundStartTimestamp + contributionFrequency;
        graceEnd = end + gracePeriod;
    }

    function isContributionDue(address member) external view returns (bool) {
        if (!memberData[member].isActive) return false;
        return memberData[member].lastContributionAt < roundStartTimestamp;
    }

    function getAavePosition() external view returns (uint256 principal, uint256 aaveBalance, uint256 yield) {
        principal = totalPrincipal;
        aaveBalance = aToken.balanceOf(address(this));
        yield = getAccruedYield();
    }

    // ──────────────────────── Internal Functions ────────────────────────

    function _validateConfig(CircleConfig memory config) internal view {
        if (config.contributionAmount < MIN_CONTRIBUTION || config.contributionAmount > MAX_CONTRIBUTION) revert InvalidConfiguration();
        if (config.minMembersToActivate < MIN_MEMBERS || config.minMembersToActivate > MAX_MEMBERS) revert InvalidConfiguration();
        if (config.maxMembers < config.minMembersToActivate || config.maxMembers > MAX_MEMBERS) revert InvalidConfiguration();
        if (config.contributionFrequency != WEEKLY && config.contributionFrequency != MONTHLY) revert InvalidConfiguration();
        if (
            config.gracePeriod != GRACE_12H &&
            config.gracePeriod != GRACE_24H &&
            config.gracePeriod != GRACE_48H &&
            config.gracePeriod != GRACE_72H
        ) revert InvalidConfiguration();
        if (config.communityReserveBps > 100) revert InvalidConfiguration();
        if (config.circleType == CircleType.SAVINGS_SPLIT) {
            if (config.maturityTimestamp <= block.timestamp) revert InvalidConfiguration();
        }
    }

    function _isInContributionWindow() internal view returns (bool) {
        return block.timestamp <= (roundStartTimestamp + contributionFrequency + gracePeriod);
    }

    function _countActiveMembers() internal view returns (uint256 count) {
        for (uint256 i = 0; i < members.length; i++) {
            if (memberData[members[i]].isActive) count++;
        }
    }

    function _advanceRound() internal {
        currentRound++;
        roundStartTimestamp = block.timestamp;
        contributionsThisRound = 0;
        netContributionsThisRound = 0;
        emit RoundAdvanced(address(this), currentRound);
    }

    function _completeCircle() internal {
        uint256 aaveBalance = aToken.balanceOf(address(this));
        if (aaveBalance > 0) {
            aavePool.withdraw(address(token), type(uint256).max, address(this));
            totalPrincipal = 0;
        }

        uint256 contractBalance = token.balanceOf(address(this));
        if (contractBalance > accumulatedFees) {
            accumulatedFees = contractBalance;
        }
        if (accumulatedFees > 0) {
            _flushFees();
        }

        status = CircleStatus.COMPLETED;
        if (nftContract != address(0)) {
            for (uint256 i = 0; i < members.length; i++) {
                address member = members[i];
                if (memberData[member].isActive && memberData[member].hasReceived) {
                    try IMotsheloNFT(nftContract).mint(member, address(this)) returns (uint256 tokenId) {
                        emit BadgeMinted(member, tokenId, address(this));
                    } catch {}
                }
            }
        }
    }

    function _flushFees() internal {
        if (accumulatedFees == 0) return;
        uint256 feesToFlush = accumulatedFees;
        accumulatedFees = 0;
        token.safeTransfer(feeCollector, feesToFlush);
        IFeeCollector(feeCollector).receiveFees(address(token), feesToFlush);
        emit FeesCollected(address(this), feesToFlush);
    }

    function _moveToEndOfQueue(address member) internal {
        MemberData storage data = memberData[member];
        uint256 oldPosition = data.rotationPosition;
        if (oldPosition >= rotationSize) return;

        for (uint256 i = oldPosition; i < rotationSize - 1; i++) {
            address nextMember = rotationOrder[i + 1];
            rotationOrder[i] = nextMember;
            memberData[nextMember].rotationPosition = i;
        }
        rotationOrder[rotationSize - 1] = member;
        data.rotationPosition = rotationSize - 1;
    }

    function _redistributeSlash(uint256 amount, address excludeMember) internal {
        uint256 activeCount = _countActiveMembers() - 1;
        if (activeCount == 0) return;

        uint256 perMember = amount / activeCount;
        uint256 remainder = amount % activeCount;
        bool remainderAssigned;
        for (uint256 i = 0; i < members.length; i++) {
            address m = members[i];
            if (m != excludeMember && memberData[m].isActive) {
                memberData[m].contributed += perMember;
                if (!remainderAssigned && remainder > 0) {
                    memberData[m].contributed += remainder;
                    remainderAssigned = true;
                }
            }
        }
    }

    // Funds stay in Aave and are reassigned to other members,
    // so totalDeposited is NOT decremented.
    function _expelMember(address member) internal {
        MemberData storage data = memberData[member];
        uint256 contributedAmount = data.contributed;
        data.contributed = 0;
        _removeFromRotation(member);
        _redistributeSlash(contributedAmount, member);
        data.isActive = false;
        emit MemberExited(address(this), member, 0);
    }

    function _removeFromRotation(address member) internal {
        uint256 position = memberData[member].rotationPosition;
        if (rotationSize == 0 || position >= rotationSize) return;

        for (uint256 i = position; i < rotationSize - 1; i++) {
            address nextMember = rotationOrder[i + 1];
            rotationOrder[i] = nextMember;
            memberData[nextMember].rotationPosition = i;
        }
        delete rotationOrder[rotationSize - 1];
        rotationSize--;
    }

    function _requestRandomOrder() internal {
        vrfRequestId = i_vrfCoordinator.requestRandomWords(vrfKeyHash, vrfSubscriptionId, 3, 200000, 1);
        vrfFulfilled = false;
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        _shuffleRotationOrder(randomWords[0]);
        vrfFulfilled = true;
    }

    function _shuffleRotationOrder(uint256 seed) internal {
        uint256 n = rotationSize;
        if (n < 2) return;

        for (uint256 i = n - 1; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encodePacked(seed, i))) % (i + 1);
            if (i == j) continue;
            address temp = rotationOrder[i];
            rotationOrder[i] = rotationOrder[j];
            rotationOrder[j] = temp;
            address addrAtI = rotationOrder[i];
            address addrAtJ = rotationOrder[j];
            memberData[addrAtI].rotationPosition = i;
            memberData[addrAtJ].rotationPosition = j;
        }
    }
}

contract MotsheloFactory is Ownable2Step {
    address public feeCollector;
    address public nftContract;
    address public registry;
    address public vrfCoordinator;
    bytes32 public vrfKeyHash;
    uint64 public vrfSubscriptionId;
    address public aavePool;
    address public aToken;

    mapping(address => bool) public approvedTokens;
    mapping(address => bool) public isDeployedCircle;
    address[] public allCircles;
    mapping(address => address[]) public userCircles;

    event CircleDeployed(address indexed circle, address indexed creator, MotsheloCircle.CircleType circleType, address token);
    event TokenApproved(address indexed token, bool approved);
    event DependencyUpdated(address feeCollector, address nftContract, address registry);
    event VrfUpdated(address vrfCoordinator, bytes32 vrfKeyHash, uint64 vrfSubscriptionId);
    event AaveConfigUpdated(address aavePool, address aToken);

    error TokenNotApproved();
    error InvalidAddress();

    constructor(
        address _feeCollector,
        address _nftContract,
        address _registry,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint64 _vrfSubscriptionId,
        address _aavePool,
        address _aToken
    ) Ownable(msg.sender) {
        if (_feeCollector == address(0) || _vrfCoordinator == address(0)) revert InvalidAddress();
        if (_aavePool == address(0) || _aToken == address(0)) revert InvalidAddress();
        feeCollector = _feeCollector;
        nftContract = _nftContract;
        registry = _registry;
        vrfCoordinator = _vrfCoordinator;
        vrfKeyHash = _vrfKeyHash;
        vrfSubscriptionId = _vrfSubscriptionId;
        aavePool = _aavePool;
        aToken = _aToken;
    }

    function createCircle(
        address _token,
        MotsheloCircle.CircleConfig memory _config,
        string calldata _name,
        string calldata _description,
        string calldata _imageUri
    ) external returns (address) {
        if (!approvedTokens[_token]) revert TokenNotApproved();

        MotsheloCircle circle = new MotsheloCircle(
            msg.sender,
            _token,
            feeCollector,
            nftContract,
            vrfCoordinator,
            vrfKeyHash,
            vrfSubscriptionId,
            aavePool,
            aToken,
            _config
        );

        address circleAddress = address(circle);
        allCircles.push(circleAddress);
        userCircles[msg.sender].push(circleAddress);
        isDeployedCircle[circleAddress] = true;

        if (registry != address(0)) {
            IMotsheloRegistry(registry).registerCircle(circleAddress, _name, _description, _imageUri);
        }

        emit CircleDeployed(circleAddress, msg.sender, _config.circleType, _token);
        return circleAddress;
    }

    function getCircleCount() external view returns (uint256) {
        return allCircles.length;
    }

    function getUserCircles(address user) external view returns (address[] memory) {
        return userCircles[user];
    }

    function getAllCircles(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = allCircles.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = allCircles[i];
        }
    }

    function setApprovedToken(address _token, bool _approved) external onlyOwner {
        approvedTokens[_token] = _approved;
        emit TokenApproved(_token, _approved);
    }

    function updateDependencies(address _feeCollector, address _nftContract, address _registry) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAddress();
        feeCollector = _feeCollector;
        nftContract = _nftContract;
        registry = _registry;
        emit DependencyUpdated(_feeCollector, _nftContract, _registry);
    }

    function updateVRFConfig(address _vrfCoordinator, bytes32 _vrfKeyHash, uint64 _vrfSubscriptionId) external onlyOwner {
        if (_vrfCoordinator == address(0)) revert InvalidAddress();
        vrfCoordinator = _vrfCoordinator;
        vrfKeyHash = _vrfKeyHash;
        vrfSubscriptionId = _vrfSubscriptionId;
        emit VrfUpdated(_vrfCoordinator, _vrfKeyHash, _vrfSubscriptionId);
    }

    function updateAaveConfig(address _aavePool, address _aToken) external onlyOwner {
        if (_aavePool == address(0) || _aToken == address(0)) revert InvalidAddress();
        aavePool = _aavePool;
        aToken = _aToken;
        emit AaveConfigUpdated(_aavePool, _aToken);
    }
}

contract FeeCollector is Ownable2Step {
    using SafeERC20 for IERC20;

    address public factory;
    mapping(address => uint256) public collectedFees;

    event FeesReceived(address indexed token, uint256 amount);
    event FeesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event FactoryUpdated(address indexed factory);
    event UntrackedSwept(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error NotAuthorizedCircle();
    error InvalidAmount();

    constructor(address _factory) Ownable(msg.sender) {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    function receiveFees(address _token, uint256 amount) external {
        if (!ICircleFactory(factory).isDeployedCircle(msg.sender)) revert NotAuthorizedCircle();
        collectedFees[_token] += amount;
        emit FeesReceived(_token, amount);
    }

    function withdrawFees(address _token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        collectedFees[_token] -= amount;
        IERC20(_token).safeTransfer(to, amount);
        emit FeesWithdrawn(_token, to, amount);
    }

    function withdrawAllFees(address _token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = collectedFees[_token];
        collectedFees[_token] = 0;
        IERC20(_token).safeTransfer(to, balance);
        emit FeesWithdrawn(_token, to, balance);
    }

    function sweepUntracked(address _token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 actual = IERC20(_token).balanceOf(address(this));
        uint256 tracked = collectedFees[_token];
        if (actual < tracked) revert InvalidAmount();
        uint256 untracked = actual - tracked;
        if (amount > untracked) revert InvalidAmount();
        IERC20(_token).safeTransfer(to, amount);
        emit UntrackedSwept(_token, to, amount);
    }

    function updateFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
        emit FactoryUpdated(_factory);
    }
}

contract MotsheloRegistry is Ownable2Step {
    struct CircleMetadata {
        string name;
        string description;
        string imageUri;
        uint256 createdAt;
        bool isVerified;
    }

    address public factory;
    mapping(address => CircleMetadata) public circleMetadata;
    mapping(address => bool) public registeredCircles;

    event CircleRegistered(address indexed circle, string name);
    event CircleVerified(address indexed circle);
    event MetadataUpdated(address indexed circle);
    event FactoryUpdated(address indexed factory);

    error OnlyFactory();
    error OnlyCircleCreatorOrOwner();
    error NotRegistered();
    error ZeroAddress();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(address _factory) Ownable(msg.sender) {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    function registerCircle(
        address circle,
        string calldata name,
        string calldata description,
        string calldata imageUri
    ) external onlyFactory {
        registeredCircles[circle] = true;
        circleMetadata[circle] = CircleMetadata({
            name: name,
            description: description,
            imageUri: imageUri,
            createdAt: block.timestamp,
            isVerified: false
        });
        emit CircleRegistered(circle, name);
    }

    function verifyCircle(address circle) external onlyOwner {
        if (!registeredCircles[circle]) revert NotRegistered();
        circleMetadata[circle].isVerified = true;
        emit CircleVerified(circle);
    }

    function updateMetadata(address circle, string calldata name, string calldata description, string calldata imageUri) external {
        if (!registeredCircles[circle]) revert NotRegistered();
        if (msg.sender != MotsheloCircle(circle).creator() && msg.sender != owner()) {
            revert OnlyCircleCreatorOrOwner();
        }
        CircleMetadata storage meta = circleMetadata[circle];
        meta.name = name;
        meta.description = description;
        meta.imageUri = imageUri;
        emit MetadataUpdated(circle);
    }

    function updateFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
        emit FactoryUpdated(_factory);
    }
}

contract MotsheloNFT is ERC721URIStorage, Ownable2Step {
    uint256 private _tokenIdCounter;
    string public baseURI;
    address public factory;
    mapping(uint256 => address) public mintedForCircle;

    event Minted(address indexed to, uint256 tokenId, address indexed circle);
    event FactoryUpdated(address indexed factory);
    error SoulboundToken();
    error NotAuthorizedCircle();
    error ZeroAddress();

    constructor(string memory _baseURI, address _factory) ERC721("Motshelo Badge", "MOTS") Ownable(msg.sender) {
        if (_factory == address(0)) revert ZeroAddress();
        baseURI = _baseURI;
        factory = _factory;
    }

    function mint(address to, address circle) external returns (uint256) {
        if (!ICircleFactory(factory).isDeployedCircle(msg.sender)) revert NotAuthorizedCircle();
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked(baseURI, Strings.toString(tokenId))));
        mintedForCircle[tokenId] = circle;
        emit Minted(to, tokenId, circle);
        return tokenId;
    }

    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
        emit FactoryUpdated(_factory);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        return super._update(to, tokenId, auth);
    }
}
