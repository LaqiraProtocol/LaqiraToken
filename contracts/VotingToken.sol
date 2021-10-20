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
    using SafeMath for uint256;
    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    mapping(address => address) private _delegates;
    mapping(address => Checkpoint[]) private _checkpoints;
    Checkpoint[] private _totalSupplyCheckpoints;

    /**
     * @dev Emitted when an account changes their delegate.
     */
    event DelegateeChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);


    /**
     * @dev Emitted when a token transfer or delegate change results in changes to an account's voting power.
     */
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
}