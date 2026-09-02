// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title USDTToken
 * @dev Custom ERC20 token simulating USDT with initial batch distribution capability.
 */
contract USDTToken is ERC20, ERC165 {
    /**
     * @dev Deploys the USDT token and distributes initial supply in a single transaction.
     * @param initialOwner Address receiving the remaining initial supply.
     * @param recipients Array of wallet addresses receiving 100,000 USDT each.
     */
    constructor(
        address initialOwner,
        address[] memory recipients
    ) ERC20("Tether USD", "USDT") {
        require(initialOwner != address(0), "Invalid initial owner address");

        uint256 amountPerRecipient = 100_000 * (10 ** decimals());
        uint256 totalBatchDistributed = 0;

        // Mint 100,000 USDT to each recipient address directly during deployment
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            _mint(recipients[i], amountPerRecipient);
            totalBatchDistributed += amountPerRecipient;
        }

        uint256 maxSupply = 10_000_000 * (10 ** decimals());
        require(totalBatchDistributed <= maxSupply, "Batch distribution exceeds max supply");

        // Mint the remaining balance to the initial owner
        _mint(initialOwner, maxSupply - totalBatchDistributed);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }
}
