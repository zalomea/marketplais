// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/**
 * @title ReputationRegistryMock
 * @dev Mock reputation registry for testing MarketplaceRouter settlement
 *      resilience when giveFeedback reverts.
 */
contract ReputationRegistryMock {
    error GiveFeedbackReverted();

    bool public shouldRevert;

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function giveFeedback(
        uint256,
        int128,
        uint8,
        string calldata,
        string calldata,
        string calldata,
        string calldata,
        bytes32
    ) external view {
        if (shouldRevert) {
            revert GiveFeedbackReverted();
        }
    }
}
