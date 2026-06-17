// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/**
 * @title IReputationRegistry
 * @dev Interface for the ERC-8004 Reputation Registry.
 * It manages trust signals for agents as signed fixed-point numbers.
 */
interface IReputationRegistry {

    // --- Events ---

    /**
     * @notice Emitted when feedback is recorded for an agent.
     */
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string endpoint
    );

    // --- Core Functions ---

    /**
     * @notice Records a feedback signal for an agent with 8 parameters.
     * @dev Prevents self-feedback by checking the agent owner/operator via Identity Registry.
     * @param agentId The identifier of the agent receiving feedback.
     * @param value The numeric value of the signal (int128).
     * @param valueDecimals The precision of the value (0-18).
     * @param tag1 Primary categorization tag (e.g., "mcp", "performance").
     * @param tag2 Secondary categorization tag (e.g., "accuracy", "latency").
     * @param endpoint The specific agent endpoint or service URI related to this feedback.
     * @param feedbackURI URI pointing to a verbose off-chain JSON payload.
     * @param feedbackHash Hash of the off-chain payload for integrity.
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    // --- Read & Aggregation Functions ---

    /**
     * @notice Returns all feedback for an agent, filtered by clients and tags.
     */
    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) external view returns (bytes[] memory feedbacks);

    /**
     * @notice Returns a summary of feedback signals for an agent.
     * @dev Requires clientAddresses to mitigate Sybil/spam risks.
     * @return count Total number of feedbacks found.
     * @return summaryValue Aggregated signal value.
     * @return summaryValueDecimals Precision of the aggregated value.
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint256 count, int128 summaryValue, uint8 summaryValueDecimals);
}
