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
sudo git remote update
sudo git fetch
sudo git checkout --track -b origin/add-pleion-docter-patient-sample
```
4. Commit and push changes
```
sudo git commit -a -m "Update README.md"
sudo git push origin add-pleion-docter-patient-sample
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
Instructions taken from [Install Fabric and Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html).

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
## Getting Started 
### Monitoring
[Run Prometheus-Grafana](https://medium.com/coinmonks/hyperledger-fabric-v2-x-monitoring-using-prometheus-974e433073f5)
1. Navigate to `prometheus-grafana` directory of the test network.
```
cd test-network\prometheus-grafana
```
2. Start the Prometheus and Grafana service.
```
docker-compose up
```
3. Start fabric test network and create a channel `mychannel`
```
cd ../
./network.sh up createChannel -ca -c mychannel
```
[Hyperledger Explorer](https://github.com/hyperledger-labs/blockchain-explorer)
1. Navigate to explorer folder and start 
```
cd pleion/pleion-patient-doctor/explorer
sudo docker-compose up -d
```

[Hyperledger REST API Swagger](https://raw.githubusercontent.com/hyperledger/blockchain-explorer/master/app/swagger.json)


### Test network
[Run Fabric Samples](https://hyperledger-fabric.readthedocs.io/en/latest/getting_started_run_fabric.html)
1. Run test-network
```
cd pleion/fabric-samples/test-network
sudo ./network.sh createChannel -c channel1
```

