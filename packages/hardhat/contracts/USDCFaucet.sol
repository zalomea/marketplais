// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IERC20 } from "./interfaces/IERC20.sol";

error FaucetOutOfFunds();
error TransferFailed();

contract USDCFaucet {
    // slither-disable-next-line naming-convention
    IERC20 public immutable USDC;
    uint256 public constant DRIP_AMOUNT = 1000 * 10 ** 6; // 1,000 USDC (USDC has 6 decimals)

    constructor(address _usdcAddress) {
        USDC = IERC20(_usdcAddress);
    }

    // Function called by your frontend
    function requestTokens() external {
        if (USDC.balanceOf(address(this)) < DRIP_AMOUNT) revert FaucetOutOfFunds();

        // Send tokens to the caller
        if (!USDC.transfer(msg.sender, DRIP_AMOUNT)) revert TransferFailed();
    }
}
