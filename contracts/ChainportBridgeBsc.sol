pragma solidity ^0.6.12;

import "./BridgeMintableToken.sol";


contract ChainportBridgeBsc{

    mapping(address => uint) public balancesByAddresses;
    mapping(address => address) public bep20ByErc20Address;

    event TokensMinted(address tokenAddress, address issuer, uint amount);
    event TokensBurned(address tokenAddress, address issuer, uint amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol);


    function mintNewToken(address erc20_address, string memory tokenName, string memory tokenSymbol) public {
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol);

        bep20ByErc20Address[address(erc20_address)] = address(newToken);
        TokenCreated(address(newToken), erc20_address, tokenName, tokenSymbol);
    }

    function mintTokens(address token, address receiver, uint256 amount) public payable{
        BridgeMintableToken ercToken = BridgeMintableToken(token);


        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;
        ercToken.mint(receiver, amount);

        emit TokensMinted(token, msg.sender, amount);
    }

    function burnTokens(address bep20Token, uint256 amount) public payable{
        BridgeMintableToken ercToken = BridgeMintableToken(bep20Token);

        ercToken.burnFrom(address(msg.sender), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)]- amount;

        TokensBurned(address(ercToken), msg.sender, amount);
    }
}
