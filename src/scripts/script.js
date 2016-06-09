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


    function loadData() {
        var requests = [];

        // var podsReq = getJson('/api/v1/pods?labelSelector=visualize%3Dtrue')
        var podsReq = getJson('pods.json')
            .then(function (data) {
                pods = data.items;
            });
        requests.push(podsReq);

        // var deploymentsReq = getJson('/apis/extensions/v1beta1/namespaces/default/deployments/?labelSelector=visualize%3Dtrue')
        var deploymentsReq = getJson('deployment.json')
            .then(function (data) {
                deployments = data.items;
            });
        requests.push(deploymentsReq);

        var servicesReq = getJson('/api/v1/services?labelSelector=visualize%3Dtrue')
            .then(function (data) {
                services = data.items;
            });
        requests.push(servicesReq);

        var nodesReq = getJson('/api/v1/nodes')
            .then(function (data) {
                nodes = data.items;
            });
        requests.push(nodesReq);

        return Promise.all(requests);
    }

    function draw(clusterInstance) {
        pods = [];
        services = [];
        deployments = [];
        nodes = [];
        groups = {};


        loadData().then(function () {
            document.querySelector(CANVAS_CLUSTER).innerHTML = '';
            document.querySelector(CANVAS_NODES).innerHTML = '';

            groupByName();
            renderNodes(nodes);
            renderGroups(groups);

            clusterInstance.batch(function () {
                clusterInstance.detachEveryConnection();
                clusterInstance.deleteEveryEndpoint();
                connectDeployments(clusterInstance, deployments, pods);
                connectServices(clusterInstance, services, pods);
            });
        });
    }

    function setDefaults(clusterInstance) {
        clusterInstance.importDefaults({
            Connector: ["Flowchart", { cornerRadius: 5 }]
        });
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

            httpRequest.open('GET', url, true);
            httpRequest.send();
        });

        return promise;
    }

    function insertPod(index, value) {
        if (!value || !value.metadata.labels || !value.metadata.name) {
            return;
        }
        var key = value.metadata.labels.app;
        initGroup(group, key);
        var group = groups[key];

        if (!group.pods) {
            group.pods = [];
        }
        group.pods.push(value);
    }

    function insertService(index, value) {
        if (!value || !value.spec.selector || !value.spec.selector.app || !value.metadata.name) {
            return;
        }
        var key = value.spec.selector.app;
        initGroup(group, key);
        var group = groups[key];

        if (!group.services) {
            group.services = [];
        }
        group.services.push(value);
    }

    function insertDeployment(index, value) {
        if (!value || !value.spec.selector || !value.spec.selector.matchLabels || !value.spec.selector.matchLabels.app || !value.metadata.name) {
            return;
        }
        var key = value.spec.selector.matchLabels.app;
        initGroup(group, key);
        var group = groups[key];

        if (!group.deployments) {
            group.deployments = [];
        }
        group.deployments.push(value);
    }

    function initGroup(group, key) {
        var group = groups[key];
        if (!group) {
            group = {};
            groups[key] = group;
        }
    }

    function groupByName() {
        // pods first. Important to calculate service placement.
        forEach(pods, insertPod);
        forEach(deployments, insertDeployment);
        forEach(services, insertService);
    }
})();
