pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IToken.sol';

contract BridgeEth {
    address public admin;
    IToken public token;


    address public vault;
    mapping(address => uint) public balancesByAddresses;

    constructor(address _token) public {
        admin = msg.sender;
        token = IToken(_token);
    }


    function freezeToken(address token) {
        IToken ercToken = IToken(token);
        uint tokenSent = ercToken.balanceOf(address(this));
        ercToken.transfer(address(vault), tokenSent);
//
        balancesByAddresses[ercToken.address] //Add to the balance of the bridge.

    }

    function releaseTokens(address token, address receiver, uint amount)


}
