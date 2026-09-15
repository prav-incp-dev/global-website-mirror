// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SplitPayment is ReentrancyGuard {
    
    event SplitExecuted(address indexed from, address indexed token, uint256 totalAmount);

    /**
     * @dev Распределяет токены ERC20 на несколько адресов за одну транзакцию.
     * Перед вызовом пользователь должен вызвать approve на контракте USDT для этого контракта.
     */
    function splitPayment(
        address tokenAddress,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Recipients list is empty");

        IERC20 token = IERC20(tokenAddress);
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            totalAmount += amounts[i];

            // Переводим токены напрямую от msg.sender к получателю
            bool success = token.transferFrom(msg.sender, recipients[i], amounts[i]);
            require(success, "Token transfer failed");
        }

        emit SplitExecuted(msg.sender, tokenAddress, totalAmount);
    }
}
