pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
//import "@openzeppelin/contracts/proxy/Initializable.sol";
//import "@openzeppelin/contracts/access/Roles.sol";
//import "@openzeppelin/contracts/ownership/Ownable.sol";

//import './BridgeEthVault.sol';

//Check what do to with more decimals

contract ChainportBridgeEth{
    //contract BridgeEth is Ownable{
//    using Roles for Roles.Role;

//    Roles.roles private _maintainers;
//    Roles.roles private _congress;

//    address public admin;
//    address public vault;

    mapping(address => uint) public balancesByAddresses;

    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);
//    event AdminChanged(address newAdmin);


//    function initialize(address _admin, address _vault) public initializer {
//
//    }

//    function setAdmin(address newAdmin) onlyChainportCongress {
//        require(!newAdmin);
//        admin = newAdmin;
//        emit AdminChanged(newAdmin);
//    }

//    function setVault(address newVault) onlyChainportCongress {
//        require(!vault);
//        vault = newVault;
//    }

    function freezeToken(address token, uint256 amount) public payable{
        IERC20 ercToken = IERC20(token);
//        uint tokenSent = ercToken.balanceOf(address(this));

        ercToken.transferFrom(address(msg.sender), address(this), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
//        require(_maintainers.has(msg.sender), "DOES_NOT_HAVE_MAINTAINER_ROLE");
        require(balancesByAddresses[address(token)] >= amount);

//        address _vault = BridgeEthVault(vault);
//        _vault.transferTokens(token, receiver, amount);

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)] - amount;
        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
