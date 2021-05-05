//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "./BridgeMintableToken.sol";
import "./ChainportUpgradables.sol";


contract ChainportBridgeBsc is ChainportUpgradables {

    mapping(address => address) public erc20ToBep20Address;

    event TokensMinted(address tokenAddress, address issuer, uint amount);
    event TokensBurned(address tokenAddress, address issuer, uint amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);

    // Set initial addresses
    function initialize(
        address _chainportCongress,
        address _maintainersRegistry
    )
    public
    initializer
    {
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
    }

    function mintNewToken(
        address erc20_address,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    )
    public
    onlyMaintainer
    {
        //TODO: Check if token exists previously -- require
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);

        erc20ToBep20Address[address(erc20_address)] = address(newToken);
        TokenCreated(address(newToken), erc20_address, tokenName, tokenSymbol, decimals);
    }

    function mintTokens(
        address token,
        address receiver,
        uint256 amount
    )
    public
    onlyMaintainer
    {
        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }


    function burnTokens(address bep20Token, uint256 amount) public {
        BridgeMintableToken ercToken = BridgeMintableToken(bep20Token);
        ercToken.burnFrom(address(msg.sender), amount);
        TokensBurned(address(ercToken), msg.sender, amount);
    }
}
