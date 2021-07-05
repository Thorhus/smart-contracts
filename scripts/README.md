# Chainport Scripts

Chainport scripts usage guide.

## Developer Instructions

### encodeParams.js

- First argument is comma separated string with argument types
- Second argument is comma separated string with argument values

- Example of transferring 1500000 tokens to `0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381`:
```angular2html
$ node encodeParams.js 'address,uint256' '0xf3B39c28bF4c5c13346eEFa8F90e88B78A610381,1500000000000000000000000'
```

---

### How to use contract upgrading scripts (ex. upgradeChainportContract.js)

- __*Step 1:*__ Start node in the project directory using terminal:
```angular2html
$ npx hardhat node
```


- __*Step 2:*__ Upgrade contract with hardhat using this template:
```angular2html
$ npx hardhat run --network {desired_network_name} scripts/{desired_upgrading_script}
```
- __Ex:__ Upgrade ChainportBridgeEth on ropsten network:
```angular2html
$ npx hardhat run --network ropsten scripts/upgradeChainportBridgeEth.js
```

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
### Congress submit proposal and vote

- _**Step 1:**_ Select method to execute and destination contract
- _**Step 2:**_ Generate calldata (explained in `encodeParams.js` section)
- _**Step 3:**_ Congress can execute multiple methods in the same transaction, but highly
  recommended is to stick with the one. (That is the reason why always array is accepted)
- _**Step 4:**_ Call the function:
```
function propose(
        address[] memory targets,
        uint[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    )
```
<br/>

- _Step 4.1:_ targets is array of destination targets (where transaction should go)
- _Step 4.2:_ values are ETH values for the corresponding targets if there's any payable method called
- _Step 4.3:_ signatures are signatures of methods being called (Ex: "transfer(address,uint256)")
- _Step 4.4:_ calldatas is the array of calldatas got from Step 2.
- _Step 4.5:_ description is array of descriptions what is done in the actions

<br/>

- _**Step 5:**_ After method propose is called (best through etherscan) members can vote
- _**Step 6:**_ During propose method event is emitted with proposalId which is used for voting
- _**Step 7:**_ Members can vote
- _**Step 8:**_ Once quorum is reached any member can execute proposal

---

### Maintainer bridge freezing

- _**Step 1:**_ Select proper method to execute (freezeBridge) in destination contract ([ChainportBridgeEth](https://etherscan.io/address/0xca9DC171AB63cC726830ac70670210f332E27Cef) or [ChainportBridgeBsc](https://bscscan.com/address/0xca9DC171AB63cC726830ac70670210f332E27Cef))
- _**Step 2:**_ Make sure that you are connected as maintainer (function can only be performed by maintainer)
- _**Step 3:**_ Call the following function through etherscan:
``` 
function freezeBridge() 
```

Function takes no arguments

---

### Congress bridge unfreezing

- _**Step 1:**_ Select proper method to execute (unfreezeBridge) in destination contract ([ChainportBridgeEth](https://etherscan.io/address/0xca9DC171AB63cC726830ac70670210f332E27Cef) or [ChainportBridgeBsc](https://bscscan.com/address/0xca9DC171AB63cC726830ac70670210f332E27Cef))
- _Step 1.1:_ Keep in mind that given function should be called only when the bridge is already frozen
- _**Step 2:**_ Since the function requires congress members proposal and voting we will call it the next way:
- _Step 2.1:_ First take a look at the function
``` 
function unfreezeBridge() 
```
Function takes no arguments

- _Step 2.2:_ Targets are destinations where transfer should go (blockchain address of the target or targets since its an array)
- _Step 2.3:_ Values are corresponding values for payable functions (we don't have any therefore its 0)
- _Step 2.4:_ Signatures are signatures for given functions, for every function they are example of a function call with argument types (in our case 'unfreezeBridge()')
- _Step 2.5:_ Since the function has no arguments we do not need to generate calldata (In the place for calldata argument just put 0x)
- _Step 2.6:_ Description should be action that we want to perform (Unfreeze the bridge) 

- _**Step 3:**_ Put everything together like bellow:
```
targets: ["TARGET ADDRESS"]                   // Put the target address/addresses here (with quotes)
values: [0]
signatures: ["unfreezeBridge()"]
calldatas: [0x]
description: ["Unfreeze the bridge."]
```
- _**Step 4:**_ Call the propose method with given arguments (through etherscan, [ChainportCongress](https://etherscan.io/address/0xB6b4C7aC240b1f176c5589d064733066a83884a1) contract)
- _**Step 5:**_ During propose method event is emitted with proposalId which is used for voting
- _**Step 6:**_ Members can vote
- _**Step 7:**_ Once quorum is reached any member can execute proposal and therefore function will be executed

---

### Congress approve locked withdraw
- _**Step 1:**_ Select proper method to execute (approveWithdrawalAndTransferFunds) in destination contract ([ChainportBridgeEth](https://etherscan.io/address/0xca9DC171AB63cC726830ac70670210f332E27Cef))
- _**Step 2:**_ Since the function requires congress members proposal and voting we will call it the next way:
- _Step 2.1:_ First take a look at the function
```
function approveWithdrawalAndTransferFunds(
        address token
    )
```

_Args:_ token is address of the token we want to withdraw

- _Step 2.2:_ Targets are destinations where transfer should go (blockchain address of the target or targets since its an array)
- _Step 2.3:_ Values are corresponding values for payable functions (we don't have any therefore its 0)
- _Step 2.4:_ Signatures are signatures for given functions, for every function they are example of a function call with argument types (in our case 'approveWithdrawalAndTransferFunds(address)')
- _Step 2.5:_ Since this function has argument it is necessary to generate a calldata using encodeParams.js like this (replace TOKEN_ADDRESS with address of token you want to withdraw):
``` $ node encodedParams.js 'address' 'TOKEN_ADDRESS'  ``` 
- _Step 2.6:_ Description should be action that we want to perform (Approve withdrawal and transfer funds.) 

- _**Step 3:**_ Put everything together like bellow:
```
targets: ["TARGET ADDRESS"]                   // Put the target address/addresses here (with quotes)
values: [0]
signatures: ["approveWithdrawalAndTransferFunds(address)"]
calldatas: [CALLDATA]                         // Put here calldata we just generated (without the quotes)
description: ["Approve withdrawal and transfer funds."]
```
- _**Step 4:**_ Call the propose method with given arguments (through etherscan, [ChainportCongress](https://etherscan.io/address/0xB6b4C7aC240b1f176c5589d064733066a83884a1) contract)
- _**Step 5:**_ During propose method event is emitted with proposalId which is used for voting
- _**Step 6:**_ Members can vote
- _**Step 7:**_ Once quorum is reached any member can execute proposal and therefore function will be executed

---

### Congress reject locked withdraw
- _**Step 1:**_ Select proper method to execute (rejectWithdrawal) in destination contract ([ChainportBridgeEth](https://etherscan.io/address/0xca9DC171AB63cC726830ac70670210f332E27Cef))
- _**Step 2:**_ Since the function requires congress members proposal and voting we will call it the next way:
- _Step 2.1:_ First take a look at the function
```
function rejectWithdrawal(
        address token
    )
```

_Args:_ token is address of the token we want to withdraw

- _Step 2.2:_ Targets are destinations where transfer should go (blockchain address of the target or targets since its an array)
- _Step 2.3:_ Values are corresponding values for payable functions (we don't have any therefore its 0)
- _Step 2.4:_ Signatures are signatures for given functions, for every function they are example of a function call with argument types (in our case 'rejectWithdrawal(address)')
- _Step 2.5:_ Since this function has argument it is necessary to generate a calldata using encodeParams.js like this (replace TOKEN_ADDRESS with address of token you want to reject withdraw of):
``` $ node encodedParams.js 'address' 'TOKEN_ADDRESS'  ``` 
- _Step 2.6:_ Description should be action that we want to perform (Reject token withdrawal.) 

- _**Step 3:**_ Put everything together like bellow:
```
targets: ["TARGET ADDRESS"]                   // Put the target address/addresses here (with quotes)
values: [0]
signatures: ["rejectWithdrawal(address)"]
calldatas: [CALLDATA]                         // Put here calldata we just generated (without the quotes)
description: ["Reject token withdrawal."]
```
- _**Step 4:**_ Call the propose method with given arguments (through etherscan, [ChainportCongress](https://etherscan.io/address/0xB6b4C7aC240b1f176c5589d064733066a83884a1) contract)
- _**Step 5:**_ During propose method event is emitted with proposalId which is used for voting
- _**Step 6:**_ Members can vote
- _**Step 7:**_ Once quorum is reached any member can execute proposal and therefore function will be executed

---

### Find contracts on etherscan
- _**ChainportBridgeEth ->**_ https://etherscan.io/address/0xca9DC171AB63cC726830ac70670210f332E27Cef
- _**ChainportBridgeBsc ->**_ https://bscscan.com/address/0xca9DC171AB63cC726830ac70670210f332E27Cef
- _**ChainportCongress ->**_ https://etherscan.io/address/0xB6b4C7aC240b1f176c5589d064733066a83884a1
