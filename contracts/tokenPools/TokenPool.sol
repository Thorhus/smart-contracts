// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "../interfaces/IERC20.sol";

/**
 * LongTermTokenPool contract.
 * @author Idan Portal
 * Date created: 07.04.21.
 * Github: 4tal
 */
abstract contract TokenPool is Initializable {

    uint256 public initialSupply;
    IERC20 public token;

    function initialize(
        address _token,
        uint _initialSupply
    )
    public
    initializer
    {
        token = IERC20(_token);
        initialSupply = _initialSupply;
    }
}
