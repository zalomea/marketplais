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

    /**
     * @notice Emitted when a client revokes their previously given feedback [3].
     */
    event FeedbackRevoked(uint256 indexed agentId, address indexed client, uint256 feedbackIndex);

    /**
     * @notice Emitted when a response is appended to an existing feedback entry [3].
     */
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed client,
        uint256 feedbackIndex,
        address responder,
        string responseURI
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

    /**
     * @notice Allows a client to revoke their feedback [3].
     * @param agentId The identifier of the agent.
     * @param feedbackIndex The index of the feedback to revoke.
     */
    function revokeFeedback(uint256 agentId, uint256 feedbackIndex) external;

    /**
     * @notice Appends a response (e.g., from the agent or a third party) to feedback [3].
     * @param agentId The identifier of the agent.
     * @param client The address of the original feedback provider.
     * @param feedbackIndex The index of the feedback entry.
     * @param responseURI URI for the response context.
     * @param responseHash Hash of the response content.
     */
    function appendResponse(
        uint256 agentId,
        address client,
        uint256 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external;

    // --- Read & Aggregation Functions [2] ---

    /**
     * @notice Retrieves a specific feedback entry.
     */
    function readFeedback(
        uint256 agentId,
        address client,
        uint256 feedbackIndex
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        string memory endpoint,
        string memory feedbackURI,
        bytes32 feedbackHash,
        bool revoked
    );

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
