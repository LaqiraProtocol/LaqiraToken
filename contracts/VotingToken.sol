// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./SmartToken.sol";
import "./Math.sol"; 
import "./SafeMath.sol";
/**
 * @dev Extension of BEP20 to support voting and delegation. This version supports token supply up to 2 ** 96 - 1.
 *
 * This extension keeps a history (checkpoints) of each account's vote power. Vote power can be delegated either
 * by calling the {delegate} function directly, or by providing a signature to be used with {delegateBySig}. Voting
 * power can be queried through the public accessors {getVotes} and {getPastVotes}.
 *
 * By default, token balance does not account for voting power. This makes transfers cheaper. Acquiring vote power 
 * requires token holders to delegate to themselves in order to activate checkpoints and have their voting power
 * tracked.
 */


contract VotingToken is SmartToken {
    
}