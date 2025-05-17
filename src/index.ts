import os from "os";
import fs from "fs";
import cluster from "cluster";
import randomBytes from "randombytes";
import { getAddress } from "@ethersproject/address";
import { encode as rlpEncode } from "@ethersproject/rlp";
import { keccak256 } from "@ethersproject/keccak256";
import { HDNode, entropyToMnemonic } from "@ethersproject/hdnode";

const patterns = [
  "0x00000000",
  "0x11111111",
  "0x22222222",
  "0x33333333",
  "0x44444444",
  "0x55555555",
  "0x66666666",
  "0x7777777",
  "0x88888888",
  "0x99999999",
  "0xaaaaaaaa",
  "0xbbbbbbbb",
  "0xcccccccc",
  "0xdddddddd",
  "0xeeeeeeee",
  "0xffffffff",
];
const numCPUs = os.cpus().length;
const numProcesses = Math.max(1, numCPUs - 1);
let startTime = new Date().getTime();

export function predictCreate(deployer: string): string {
  const rlp = rlpEncode([getAddress(deployer), "0x"]);
  return getAddress("0x" + keccak256(rlp).slice(26)); // drop first 12 bytes
}

if (cluster.isPrimary) {
  console.log(`Miner coordinator started with patterns [${patterns}]`);
  for (let i = 0; i < numProcesses; i++) {
    const mineWorker = cluster.fork({ alias: "Miner " + i });
    mineWorker.on("message", (message) => {
      const { address, contract, privatekey, mnemonic } = message;
      const now = new Date().getTime();
      console.log(
        new Date(),
        `Found contract ${contract} in ${Math.floor(
          (now - startTime) / 1000
        )} seconds`
      );
      startTime = now;
      try {
        fs.writeFileSync(
          "contracts.txt",
          address +
            "\n" +
            contract +
            "\n" +
            privatekey +
            "\n" +
            mnemonic +
            "\n\n",
          { flag: "a+" }
        );
      } catch (err) {
        console.error(err);
      }
    });
  }
} else {
  console.log(`${process.env.alias} started looking for patterns`);
  let contract = "";
  let mnemonic = "";
  let hdnode: HDNode;

  while (true) {
    mnemonic = entropyToMnemonic(randomBytes(32));
    hdnode = HDNode.fromMnemonic(mnemonic).derivePath("m/44'/60'/0'/0/0");
    patterns.forEach((search) => {
      contract = predictCreate(hdnode.address);
      if (contract.toLowerCase().indexOf(search) === 0 && process) {
        (<any>process).send({
          address: hdnode.address,
          contract: contract,
          privatekey: hdnode.privateKey,
          mnemonic: mnemonic,
        });
      }
    });
  }
}
