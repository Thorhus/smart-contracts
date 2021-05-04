//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * BridgeMintableToken contract.
 * @author Nikola Madjarevic
 * Date created: 21.4.21.
 * Github: madjarevicn
 */
contract BridgeMintableToken is ERC20, ERC20Burnable {

    constructor(
        string memory tokenName_,
        string memory tokenSymbol_,
        uint8 decimals_
    )
    public
    ERC20(tokenName_, tokenSymbol_)
    {
        _setupDecimals(decimals_);
    }

    event Mint(address indexed to, uint256 amount);

    function mint(
        address _to,
        uint256 _amount
    )
    public
    {
        _mint(_to, _amount);
        Mint(_to, _amount);
    }
}
