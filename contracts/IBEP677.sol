// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IBEP20.sol";

/**
 * @title IBEP677 Token interface
 * @dev see https://github.com/ethereum/EIPs/issues/677
 */

interface IBEP677 is IBEP20 {
    function transferAndCall(address receiver, uint value, bytes memory data) external returns (bool success);
    event Transfer(address indexed from, address indexed to, uint256 value, bytes data);
}