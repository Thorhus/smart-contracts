# Chainport Scripts

Chainport scripts and contracts usage guide.

## Developer Instructions

### encodeParams.js

- First argument is comma separated string with argument types
- Second argument is comma separated string with argument values

- Example of transferring 1500000 tokens to `0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381`:
```angular2html
$ node encodeParams.js 'address,uint256' '0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381,1500000000000000000000000'
```

---

### How To Use Bridge Upgrade Script For Test Environment (`upgradeChainportBridge.js`)

- Upgrade contract with hardhat using this template:
```angular2html
$ npx hardhat run --network {desired_network_name} scripts/upgradeChainportBridge.js
```
After execution of this command script will do the following:

- Detect the bridge that selected network is using
- Upgrade to new implementation
- Wait for block to change and save new implementation address to `.json` file

By the output you will know when the upgrade is finished correctly.

---
### How to use network related scripts
`activateNetworks.js` & `readNetworkStates.js`
- We use `activateNetworks.js` to automatically and conventionally activate networks that we want to support.
- We use `readNetworkStates.js` to check requested network states.
* Both of the scripts are being executed using hardhat and they autodetect type of bridge contracts on specified
network. Only step left to do is run script using this command template in your terminal.
  ```angular2html
  $ npx hardhat run --network {desired_network_name} scripts/{desired_network_related_script}
  ```
Example: 
- _**Step 1:**_ To activate specified networks on ropsten bridge contract we use next command:
  ```angular2html
  $ npx hardhat run --network ropsten scripts/activateNetworks.js
  ```
  Running this command will let the script perform necessary work on bridge contract to make specific networks active.
<br><br>
- _**Step 2:**_ Now we can run `readNetworkStates.js` to see if the networks we need are active:
  ```angular2html
  $ npx hardhat run --network ropsten scripts/readNetworkStates.js
  ```
  After running this command you should get information from console output about requested networks and their current activity states.
---

## How To Call `onlyMaintainer` Functions
Functions with the `onlyMaintainer` modifier can be called only if your wallet has been given a privilege 
of being a maintainer. You will know this either by checking `deploymentConfig.json` or by searching for it 
in the `MaintainersRegistry` contract on wanted network.
After confirming that you have maintainer privilege you will be able to call methods present on contracts from
mentioned wallet address. You can do so via script or via explorer api of wanted network and contract.
### Methods To Be Called By Maintainer
 **_MainBridge:_**
* _freezeBridge()_
* _freezeAssetByMaintainer(address asset)_
* _protectAssetByMaintainer(address asset)_
* _releaseTokensByMaintainer(bytes memory signature, address token, uint256 amount, address beneficiary, uint256 nonce)_
* _activateNetwork(uint256 networkId)_

**_SideBridge_**
* _freezeBridge()_
* _mintNewToken(address token, string memory tokenName, string memory tokenSymbol)_
* _mintTokens(address token, address receiver, uint256 amount, uint256 nonce)_
* _activateNetwork(uint256 networkId)_
* _setMaintainerWorkInProgress(bool value)_

---

## Calling Methods And Making Proposals As Chainport Congress
Methods that require special authority level with `onlyChainportCongress` modifier can be executed only by the 
_ChainportCongress_ contract. Firstly since congress has more than one single member, we have to make a proposal
in order for other congress members to see it. Then they will be able to vote and execute the proposal after the 
minimum quorum has voted 'for' the proposal and not against it.
All of the mentioned actions must be performed by congress members including proposing, voting and executing.
Before calling _ChainportCongress_ contract methods please confirm that the wallet you are using is given the
congress member privilege. Such can be confirmed by checking `deploymentConfig.json` or by searching it
in the `ChainportCongressMembersRegistry` contract on wanted network.

### How To Make A Proposal
Proposal must be made by one of the congress members by executing `propose` function on the contract networks api.

*__Propose Function Arguments:__*

```angular2html
function propose(
        address[] memory targets,
        uint[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    )
```
Attention: It is recommended to use arrays with only one argument/proposal at the time.

*__Arguments explanation:__*

`targets: ["contract_address_1", "contract_address_2" ...]` <->
`targets: ["0x1f...3aBd", "0x5b...3c"]`

Targets is an array of contract addresses that our proposal is targeting.

`values: [0, 0.1, 0.25]`

Values is an array of token values (_like ETH, BNB, MATIC - depending on blockchian_)
for payable functions only (_will be zero in most cases_).

`signatures: ["function_name(argType1,argType2)"]` <->
`signatures: ["upgradeProxy(address,address)"]`

Signatures is an array of functions that we want to call with their argument types (_without indents_).

`calldatas: [encoded_data_1, encoded_data_2]` <-> `calldatas: [0x00...5f7, 0x00...de3]`

Calldatas is an array of encoded data arguments for the function that we want to execute. It is generated
using `encodeParams.js` script. Details on how to use it can be found [here](#developer-instructions).

`description: "Perform the wanted method."` <-> `description: "Upgrade main bridge."`

Description is a string that should describe the function that we want to perform. Entirely depends on your
free will as a congress member.

### How To Vote

Voting is being performed exclusively on selected networks _ChainportCongress_ contract. The `castVote()` function
has only two arguments, `uint256 proposalId`(_id of proposal you want to vote for_) 
and `bool support`(_you can vote for it or against it <-> true or false_). 

### How To Execute Proposal

Attention: proposal can be executed only after the _minimalQuorum_ of congress has voted 'for' the proposal itself.

To execute proposal as a congress member on _ChainportCongress_ contract you will only need two arguments of
`execute()` function. Those two arguments are `proposalId` of proposal you want to execute and amount of blockchain's
main currency (_ETH, BNB, MATIC..._) in case that proposal includes _payable_ functions (most of the time it will be zero). If voting of 
minimal quorum has been done, you will be able to execute proposal as congress member.

---
