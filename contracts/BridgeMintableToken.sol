//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * BridgeMintableToken contract.
 * @author Nikola Madjarevic
 * Date created: 21.4.21.
 * Github: madjarevicn
 */
contract BridgeMintableToken is ERC20Burnable {

    address public sideBridgeContract;

    constructor(
        string memory tokenName_,
        string memory tokenSymbol_,
        uint8 decimals_
    )
    public
    ERC20(tokenName_, tokenSymbol_)
    {
        _setupDecimals(decimals_);
        sideBridgeContract = msg.sender;
    }

    event Mint(address indexed to, uint256 amount);

    function mint(
        address _to,
        uint256 _amount
    )
    public
    {
        require(msg.sender == sideBridgeContract, "Only Bridge contract can mint new tokens.");
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    //TODO understand in which scenarios we would call this function, if at all
    function setSideBridgeContract(
        address _sideBridgeContract
    )
    public
    {
        require(msg.sender == sideBridgeContract);
        require(_sideBridgeContract != address(0));
        sideBridgeContract = _sideBridgeContract;
    }
}
