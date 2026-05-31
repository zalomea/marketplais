// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IReputationRegistry } from "../interfaces/IReputationRegistry.sol";

contract MockReputationRegistry is IReputationRegistry {
    event FeedbackGiven(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string fileuri,
        bytes32 filehash,
        bytes feedbackAuth
    );

    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata fileuri,
        bytes32 filehash,
        bytes calldata feedbackAuth
    ) external override {
        emit FeedbackGiven(agentId, score, tag1, tag2, fileuri, filehash, feedbackAuth);
    }
}
