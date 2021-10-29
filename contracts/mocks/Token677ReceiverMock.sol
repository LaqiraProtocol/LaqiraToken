// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IBEP677Receiver.sol";


contract Token677ReceiverMock is IBEP677Receiver {
    address public tokenSender;
    uint public sentValue;
    bytes public tokenData;
    bool public calledFallback = false;

    function onTokenTransfer(
        address sender,
        uint value,
        bytes memory data
    )
    public override
    {
        calledFallback = true;

        tokenSender = sender;
        sentValue = value;
        tokenData = data;
    }
}