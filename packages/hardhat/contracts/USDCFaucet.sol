// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IUSDC } from "./interfaces/IUSDC.sol";

error FaucetOutOfFunds();
error TransferFailed();

contract USDCFaucet {
    // slither-disable-next-line naming-convention
    IUSDC public immutable USDC;
    uint256 public constant DRIP_AMOUNT = 1000 * 10 ** 6; // 1,000 USDC (USDC has 6 decimals)

    constructor(address _usdcAddress) {
        USDC = IUSDC(_usdcAddress);
    }

    // Function called by your frontend
    function requestTokens() external {
        if (USDC.balanceOf(address(this)) < DRIP_AMOUNT) revert FaucetOutOfFunds();

        // Send tokens to the caller
        if (!USDC.transfer(msg.sender, DRIP_AMOUNT)) revert TransferFailed();
    }
}
