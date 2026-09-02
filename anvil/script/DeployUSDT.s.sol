// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../USDT.sol";

contract DeployUSDTScript is Script {
    string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        // The rest of USDT emission goes to the standard Anvil test account #9
        uint256 deployerPrivateKey = vm.deriveKey(ANVIL_MNEMONIC, 9);
        address initialOwner = vm.addr(deployerPrivateKey);

        // Standard Anvil test accounts (Anvil test accounts #1 to #8)
        address[] memory recipients = new address[](8);
        for (uint32 i = 0; i < 8; i++) {
            uint256 recipientPrivateKey = vm.deriveKey(ANVIL_MNEMONIC, i + 1);
            recipients[i] = vm.addr(recipientPrivateKey);
        }

        vm.startBroadcast(deployerPrivateKey);

        new USDTToken(initialOwner, recipients);

        vm.stopBroadcast();
    }
}
