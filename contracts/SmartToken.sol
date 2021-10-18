// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./StandardToken.sol";
import "./IBEP677.sol";
import "./IBEP677Receiver.sol";

/**
 * @title Smart Token
 * @dev Enhanced Standard Token, with "transfer and call" possibility.
 */


contract SmartToken is StandardToken, IBEP677 {
    /**
     * @dev Current token cannot be transferred to the token contract based on follwing override modification.
     */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        validRecipient(to);
    }

    /**
     * @dev transfer token to a contract address with additional data if the recipient is a contract.
     * @param _to address to transfer to.
     * @param _value amount to be transferred.
     * @param _data extra data to be passed to the receiving contract.
     */

    function transferAndCall(address _to, uint256 _value, bytes memory _data) public override returns (bool success) {
        _transfer(_msgSender(), _to, _value);
        emit Transfer(_msgSender(), _to, _value, _data);
        if (isContract(_to)) {
            contractFallback(_to, _value, _data);
        }
        return true;
    }

    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    function contractFallback(address _to, uint _value, bytes memory _data) private {
        IBEP677Receiver receiver = IBEP677Receiver(_to);
        receiver.onTokenTransfer(_msgSender(), _value, _data);
    }

    function validRecipient(address _recipient) internal {
        require(_recipient != address(this));
    }
}