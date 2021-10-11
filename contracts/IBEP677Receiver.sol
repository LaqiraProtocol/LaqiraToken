// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title IBEP677 Receiving Contract interface
 * @dev see https://github.com/ethereum/EIPs/issues/677
 */

interface IBEP677Receiver {
    function onTokenTransfer(address _sender, uint _value, bytes memory _data) external;
}