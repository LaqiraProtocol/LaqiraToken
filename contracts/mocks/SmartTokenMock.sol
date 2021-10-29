// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../SmartToken.sol";


contract SmartTokenMock is SmartToken {
    string private constant NAME = "Example BEP20 Token";
    string private constant SYMBOL = "BEP677";

    constructor(uint initialBalance) {
        _mint(msg.sender, initialBalance);
    }
}