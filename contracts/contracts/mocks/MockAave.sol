// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAToken is ERC20 {
    address public pool;

    error NotPool();
    error PoolAlreadySet();
    error ZeroAddress();

    constructor() ERC20("Mock Aave USDT", "maUSDT") {}

    function setPool(address _pool) external {
        if (_pool == address(0)) revert ZeroAddress();
        if (pool != address(0)) revert PoolAlreadySet();
        pool = _pool;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != pool) revert NotPool();
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        if (msg.sender != pool) revert NotPool();
        _burn(from, amount);
    }
}

contract MockAavePool {
    IMintableERC20 public immutable asset;
    MockAToken public immutable aToken;

    error InvalidAsset();

    constructor(address _asset, address _aToken) {
        asset = IMintableERC20(_asset);
        aToken = MockAToken(_aToken);
    }

    function supply(address asset_, uint256 amount, address onBehalfOf, uint16) external {
        if (asset_ != address(asset)) revert InvalidAsset();
        IERC20(asset_).transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address asset_, uint256 amount, address to) external returns (uint256) {
        if (asset_ != address(asset)) revert InvalidAsset();

        uint256 balance = aToken.balanceOf(msg.sender);
        uint256 withdrawAmount = amount == type(uint256).max
            ? balance
            : (amount > balance ? balance : amount);

        aToken.burnFrom(msg.sender, withdrawAmount);
        IERC20(asset_).transfer(to, withdrawAmount);
        return withdrawAmount;
    }

    function accrueYield(address beneficiary, uint256 amount) external {
        asset.mint(address(this), amount);
        aToken.mint(beneficiary, amount);
    }
}
