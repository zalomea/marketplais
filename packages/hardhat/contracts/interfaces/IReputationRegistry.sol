// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

interface IReputationRegistry {
    /**
     * @notice Submits feedback for a specific agent.
     * @param agentId The unique identifier of the agent.
     * @param score The feedback value (e.g., 0-255).
     * @param tag1 Optional tag for categorization.
     * @param tag2 Optional second tag.
     * @param fileuri URI to off‑chain metadata.
     * @param filehash Hash of the off‑chain file for integrity.
     * @param feedbackAuth Authorization signature or proof.
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata fileuri,
        bytes32 filehash,
        bytes calldata feedbackAuth
    ) external;
}
