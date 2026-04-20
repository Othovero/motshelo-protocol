import * as fs from "fs";
import * as path from "path";

const ARTIFACTS_DIR = path.resolve(__dirname, "../artifacts/contracts/motshelo.sol");
const OUTPUT_DIR = path.resolve(__dirname, "../../lib/contracts/abis");

const CONTRACTS = [
  "MotsheloCircle",
  "MotsheloFactory",
  "FeeCollector",
  "MotsheloRegistry",
  "MotsheloNFT",
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const name of CONTRACTS) {
    const artifactPath = path.join(ARTIFACTS_DIR, `${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`Artifact not found: ${artifactPath}`);
      continue;
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const outputPath = path.join(OUTPUT_DIR, `${name}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`Exported ${name} ABI -> ${outputPath}`);
  }

  console.log("ABI export complete.");
}

main().catch(console.error);
