/**
Copyright 2014 Google Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

(function () {

    var UPDATE_INTERVAL = 3000;
    var REQUEST_TIMEOUT = 2000;

    var pods;
    var services;
    var deployments;
    var groups;

    jsPlumb.ready(function () {
        var clusterInstance = jsPlumb.getInstance();

        setDefaults(clusterInstance);
        draw(clusterInstance);

        // setInterval(function () {
        //     draw(clusterInstance);
        // }, UPDATE_INTERVAL);
    });

    function draw(clusterInstance) {
        pods = [];
        services = [];
        deployments = [];
        nodes = [];
        groups = [];

        loadData().then(function () {
            document.querySelector(CANVAS_CLUSTER).innerHTML = '';
            document.querySelector(CANVAS_NODES).innerHTML = '';

            groupByName();
            clusterInstance.batch(function () {
                clusterInstance.detachEveryConnection();
                clusterInstance.deleteEveryEndpoint();

                renderNodes(nodes);
                renderGroups(groups, clusterInstance);
            });
        });
    }

    function setDefaults(clusterInstance) {
        clusterInstance.importDefaults({
            Connector: ["Flowchart", { cornerRadius: 5 }]
        });
    }


    function loadData() {
        var requests = [];

        // var podsReq = getJson('/api/v1/pods?labelSelector=visualize%3Dtrue')
        var podsReq = getJson('pods.json')
            .then(function (data) {
                pods = data.items;
            }, function (error) {
                console.error('pods not found', error);
            });
        requests.push(podsReq);

        // var deploymentsReq = getJson('/apis/extensions/v1beta1/namespaces/default/deployments/?labelSelector=visualize%3Dtrue')
        var deploymentsReq = getJson('deployment.json')
            .then(function (data) {
                deployments = data.items;
            }, function (error) {
                console.error('deployments not found', error);
            });
        requests.push(deploymentsReq);

        // var servicesReq = getJson('/api/v1/services?labelSelector=visualize%3Dtrue')
        var servicesReq = getJson('service.json')
            .then(function (data) {
                services = data.items;
            }, function (error) {
                console.error('services not found', error);
            });
        requests.push(servicesReq);

        // var nodesReq = getJson('/api/v1/nodes')
        var nodesReq = getJson('nodes.json')
            .then(function (data) {
                nodes = data.items;
            }, function (error) {
                console.error('nodes not found', error);
            });
        requests.push(nodesReq);

        return Promise.all(requests);
    }

    function getJson(url) {
        var promise = new Promise(function (resolve, reject) {
            var httpRequest = new XMLHttpRequest();

            httpRequest.onload = function () {
                if (httpRequest.status === 200) {
                    var data = JSON.parse(httpRequest.responseText);

                    resolve(data);
                } else {
                    reject(Error(httpRequest.statusText));;
                }
            };

            httpRequest.onerror = function () {
                reject(Error('Network error'));
            };

            httpRequest.ontimeout = function () {
                reject(Error('Network timeout'));
            };

            httpRequest.open('GET', url, true);
            httpRequest.timeout = REQUEST_TIMEOUT;
            httpRequest.send();
        });

        return promise;
    }

    function groupByName() {
        forEach(services, insertService);
        forEach(pods, insertPod);
        forEach(deployments, insertDeployment);
    }

    function insertService(index, service) {
        if (!service || !service.spec || !service.spec.selector) {
            return;
        }
        var selector = service.spec.selector;

        var groupIndex = getGroupIndex(selector);

        if (groupIndex > -1) {
            groups[groupIndex].services.push(service);
        } else {
            groups.push({
                identifier: selector,
                services: [service]
            });
        }
    }

    function insertPod(index, pod) {
        if (!pod || !pod.metadata || !pod.metadata.labels) {
            return;
        }

        var labels = pod.metadata.labels;

        var groupIndex = getGroupIndex(labels);

        if (groupIndex > -1) {
            if (!groups[groupIndex].pods) {
                groups[groupIndex].pods = [];
            }
            groups[groupIndex].pods.push(pod);
        } else {
            groups.push({
                identifier: labels,
                pods: [pod]
            });
        }
    }

    function insertDeployment(index, deployment) {
        if (!deployment || !deployment.spec.selector || !deployment.spec.selector.matchLabels || !deployment.spec.selector.matchLabels.app || !deployment.metadata.name) {
            return;
        }
        var labels = deployment.spec.selector.matchLabels;
        var groupIndex = getGroupIndex(labels);

        if (groupIndex > -1) {
            if (!groups[groupIndex].deployments) {
                groups[groupIndex].deployments = [];
            }
            groups[groupIndex].deployments.push(deployment);
        } else {
            groups.push({
                identifier: labels,
                deployments: [deployment]
            });
        }
    }

    function getGroupIndex(selector) {
        for (var index = 0; index < groups.length; index++) {
            if (matchObjects(selector, groups[index].identifier)) {
                return index;
            }
        }

        return -1;
    }
})();
