// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/HelpGrowToken.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);

        HelpGrowToken hg = new HelpGrowToken(deployer);

        vm.stopBroadcast();

        console.log("HelpGrowToken deployed to:", address(hg));
        console.log("");
        console.log("Set in .env:");
        console.log("  HG_TOKEN_CONTRACT_ADDRESS=%s", vm.toString(address(hg)));

        // forge verify-contract <HG_ADDRESS> HelpGrowToken --chain base-sepolia
    }
}
