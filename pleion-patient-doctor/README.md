# Hyperledger Fabric Sample - PleioN Patient-Doctor

## Setup environment
### Git cloning and checkout
First navigate to [fabric-samples git repo](https://github.com/hyperledger/fabric-samples) and fork the fabric repository using the fork button in the top-right corner. After forking, clone the repository.

Here is a handy [git cheat sheet](https://education.github.com/git-cheat-sheet-education.pdf) for reference.

1. Clone repo.

```
sudo mkdir fabric/pleion
cd fabric/pleion
sudo git clone https://github.com/vdmerweandre/fabric-samples.git
cd fabric-samples
```
2. Install build tools and add as save downstream repo
```
sudo apt install build-essential 
sudo git config --global --add safe.directory /home/vdmerwe/fabric/pleion/fabric-samples
```
3. Sync remote and checkout branch.
```
sudo git remot update
sudo git fetch
sudo git checkout --track -b origin/add-pleion-docter-patient-sample
```
### VSCode
In order to create and save files using and ssh session using VSCode you can use the VSCode extention called [Save as Root](https://marketplace.visualstudio.com/items?itemName=yy0931.save-as-root).

1. Create directory and file.
```
sudo mkdir pleion-patient-doctor
cd pleion-patient-doctor/
sudo touch README.md
```
2. Save as root
```
ctrl P > Save as Root 
```
### Download Docker images and binaries
Instructions taken from [Install FAbric and Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html).

To get the install script run this command from your root project directory `/fabric/pleion`:

1. Get install script.
```
sudo curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
```
Above comamnd will download, but fail due to: `chmod: changing permissions of 'install-fabric.sh': Operation not permitted` 
```
sudo chmod +rwx install-fabric.sh 
ls -la
```
2. Execute script options and help options.
```
./install-fabric.sh -h
sudo ./install-fabric.sh docker binary
```
## Getting Started - Run Fabric
[Run Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/latest/getting_started_run_fabric.html)