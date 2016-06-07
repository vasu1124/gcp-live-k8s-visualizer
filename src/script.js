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

    // definitions
    var ENTITY_HEIGHT = 95;
    var NODE_SPACE = 30;

    var SRV_POD_SPACE_HOR = 190;
    var SRV_POD_SPACE_VER = 40;

    var DEPL_MIN_LEFT = 900;
    var DEPL_POD_SPACE = 200;

    var GROUP_VER = 40;

    var LINE_WIDTH = 3;
    var LINE_RADIUS = 3;

    var UPDATE_INTERVAL = 3000;

    var TYPE_POD = 'pod';
    var TYPE_SERVICE = 'service';
    var TYPE_DEPLOYMENT = 'deployment';
    var TYPE_NODE = 'node';

    var CANVAS_NODES = '.nodesbar .canvas';
    var CANVAS_CLUSTER = '.cluster .canvas';

    var COLOR_SVC_POD = 'rgb(0,153,57)';
    var COLOR_DPL_POD = 'rgb(51,105,232)';

    var pods = [];
    var services = [];
    var deployments = [];
    var groups = {};

    jsPlumb.ready(function () {
        var clusterInstance = jsPlumb.getInstance();

        setDefaults(clusterInstance);
        draw(clusterInstance);

        setInterval(function () {
            draw(clusterInstance);
        }, UPDATE_INTERVAL);
    });

    function connectDeployments(clusterInstance) {
        forEach(deployments, function (i, deployment) {
            forEach(pods, function (j, pod) {
                if (pod.metadata.labels.app === deployment.spec.selector.matchLabels.app) {
                    if (deployment.metadata.labels.version && pod.metadata.labels.version && (deployment.metadata.labels.version != pod.metadata.labels.version)) {
                        return;;
                    }
                    clusterInstance.connect({
                        source: 'deployment-' + deployment.metadata.name,
                        target: 'pod-' + pod.metadata.name,
                        anchors: ['Bottom', 'Bottom'],
                        paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLOR_DPL_POD },
                        endpointStyle: { fillStyle: COLOR_DPL_POD, radius: LINE_RADIUS }
                    });
                }
            });
        });
    }

    function connectServices(clusterInstance) {
        forEach(services, function (i, service) {
            forEach(pods, function (j, pod) {
                if (matchesLabelQuery(pod.metadata.labels, service.spec.selector)) {
                    clusterInstance.connect({
                        source: 'service-' + service.metadata.name,
                        target: 'pod-' + pod.metadata.name,
                        anchors: ["Bottom", "Top"],
                        paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLOR_SVC_POD },
                        endpointStyle: { fillStyle: COLOR_SVC_POD, radius: LINE_RADIUS }
                    });
                }
            });
        });
    }

    function getNodeProvider(node) {
        if (!node || !node.spec || !node.spec.providerID) {
            return '';
        }

        var provider = node.spec.providerID.split(':')[0];
        switch (provider) {
            case 'gce':
                return 'gce';
            default:
                return 'pi';
        }
    }

    function renderNodes() {
        var x = 0;
        var nodesbar = document.querySelector(CANVAS_NODES);

        forEach(nodes, function (i, node) {
            var ready;
            for (var j = 0; j < node.status.conditions.length; j++) {
                var condition = node.status.conditions[j];

                if (condition.type === 'Ready') {
                    ready = (condition.status === 'True' ? 'ready' : 'not-ready')
                    break;
                }
            }

            var provider = getNodeProvider(node);

            var nodeElement =
                '<div>' +
                '<a href="http://' + node.metadata.name + ':4194/"' +
                'target="_blank" rel="noreferrer nofollow"' +
                'id="node-' + node.metadata.name + '"' +
                'class="window node ' + ready + '"' +
                'title="' + node.metadata.name + '"' +
                'style="left: ' + x + 'px">' +
                '<img src="providers/' + provider + '.png" class="provider-logo" />' +
                '<span><p class="nodetitle">Node</p><br/>' +
                truncate(node.metadata.name, 12) + '</span>' +
                '</a>' +
                '</div>';

            nodesbar.insertAdjacentHTML('beforeend', nodeElement);

            x += 93 + NODE_SPACE;
        });
    }

    function renderGroups() {
        var elt = document.querySelector(CANVAS_CLUSTER);
        var y = 0;

        var groupOrder = makeGroupOrder();

        forEach(groupOrder, function (index, groupKey) {
            var group = groups[groupKey];

            if (!group) {
                return;
            }

            var groupDiv = '<div class="group">';
            var x = 0;
            var pods = 0;

            forEach(group, function (index, value) {
                var name = value.metadata.name;
                var version = value.metadata.labels.version;
                var phase = value.status.phase ? value.status.phase.toLowerCase() : '';

                var entity = undefined;
                switch (value.type) {
                    case TYPE_POD:
                        if ('deletionTimestamp' in value.metadata) {
                            phase = 'terminating';
                        }

                        var nodeName = value.spec.nodeName;
                        var podIp = value.status.podIP;

                        entity =
                            '<div class="window pod ' + phase + '" title="' + name + '" id="pod-' + name +
                            '" style="left: ' + (x + SRV_POD_SPACE_HOR) + 'px; top: ' + (y + ENTITY_HEIGHT + SRV_POD_SPACE_VER) + 'px">' +
                            '<span>' +
                            "v." + extractVersion(value.spec.containers[0].image) +
                            (version ? "<br/>" + version : "") + "<br/><br/>" +
                            (nodeName ? truncate(nodeName, 12) : "None") + "<br/><br/>" +
                            (podIp ? "<em>" + podIp + "</em>" : "<em>" + phase + "</em>") +
                            '</span>' +
                            '</div>';
                        pods++;
                        break;
                    case TYPE_SERVICE:
                        var externalIps = value.spec.externalIPs;
                        var clusterIp = value.spec.clusterIP;
                        var loadBalancer = value.status.loadBalancer && value.status.loadBalancer.ingress ? value.status.loadBalancer.ingress[0].ip : undefined;

                        entity =
                            '<div class="window wide service ' + phase + '" title="' + name + '" id="service-' + name + '" ' +
                            'style="top: ' + y + 'px">' +
                            '<span>' +
                            '<div>' + name + '</div>' +
                            (version ? "<br/>" + version : '') +
                            (externalIps ? '<br/><br/><a href="http://' + externalIps[0] + ':' + value.spec.ports[0].port + '" target="_blank" rel="noreferrer nofollow">' + externalIps[0] + ':' + value.spec.ports[0].port + '</a>' : '') +
                            (clusterIp ? '<br/><br/>' + clusterIp : '') +
                            (loadBalancer ? '<br/><a href="http://' + loadBalancer + '" target="_blank" rel="noreferrer nofollow">' + loadBalancer + '</a>' : '') +
                            '</span>' +
                            '</div>';
                        break;
                    case TYPE_DEPLOYMENT:
                        var calculatedReplicaLeft = DEPL_POD_SPACE + (value.status.replicas * 130);
                        var calculatedPodsLeft = DEPL_POD_SPACE + (pods * 130);

                        var left;
                        if (DEPL_MIN_LEFT > calculatedReplicaLeft && DEPL_MIN_LEFT > calculatedPodsLeft) {
                            left = DEPL_MIN_LEFT;
                        } else if (calculatedReplicaLeft > DEPL_MIN_LEFT && calculatedReplicaLeft > calculatedPodsLeft) {
                            left = calculatedReplicaLeft;
                        } else {
                            left = calculatedPodsLeft;
                        }

                        entity =
                            '<div class="window wide deployment" title="' + name + '" id="deployment-' + name + '" ' +
                            'style="left: ' + left + 'px; top: ' + (y + 130) + 'px">' +
                            '<span>' +
                            '<div>' + name + '</div>' +
                            '<br/>' +
                            '<div class="replicas">Replicas: ' + value.spec.replicas + "</div>" +
                            (version ? "<br/>" + version : "") +
                            '</span>' +
                            '</div>';
                        break;
                    default:
                        entity = '<div class"window" id="unknown-' + name + '">Unknown</div>';
                        break;
                }

                groupDiv += entity;
                x += 130;
            });
            groupDiv += '</div>';

            y += 2 * ENTITY_HEIGHT + SRV_POD_SPACE_VER + GROUP_VER;
            elt.insertAdjacentHTML('beforeend', groupDiv);
        });
    };

    function loadData() {
        var requests = [];

        var podsReq = getJson('/api/v1/pods?labelSelector=visualize%3Dtrue')
            .then(function (data) {
                pods = data.items;
                mapToType(pods, TYPE_POD);
            });
        requests.push(podsReq);

        var deploymentsReq = getJson('/apis/extensions/v1beta1/namespaces/default/deployments/?labelSelector=visualize%3Dtrue')
            .then(function (data) {
                deployments = data.items;
                mapToType(deployments, TYPE_DEPLOYMENT);
            });
        requests.push(deploymentsReq);

        var servicesReq = getJson('/api/v1/services?labelSelector=visualize%3Dtrue')
            .then(function (data) {
                services = data.items;
                mapToType(services, TYPE_SERVICE);
            });
        requests.push(servicesReq);

        var nodesReq = getJson('/api/v1/nodes')
            .then(function (data) {
                nodes = data.items;
                mapToType(nodes, TYPE_NODE);
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
            renderNodes();
            renderGroups();

            clusterInstance.batch(function () {
                clusterInstance.detachEveryConnection();
                clusterInstance.deleteEveryEndpoint();
                connectDeployments(clusterInstance);
                connectServices(clusterInstance);
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

    function truncate(str, width, left) {
        if (!str) return '';

        if (str.length > width) {
            if (left) {
                return str.slice(0, width) + '...';
            } else {
                return '...' + str.slice(str.length - width, str.length);
            }
        }
        return str;
    }

    function forEach(array, delegate) {
        for (var i = 0; i < array.length; i++) {
            delegate(i, array[i]);
        }
    }

    function forProperty(object, callback) {
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                callback(key, object[key]);
            }
        }
    }

    function extractVersion(image) {
        var temp = image.split(':');
        if (temp.length > 2) {
            return temp[2];
        }
        else if (temp.length > 1) {
            return temp[1];
        }
        return 'latest'
    }

    function mapToType(array, type) {
        forEach(array, function (index, node) {
            node.type = type;
        });
    }

    function insertPod(index, value) {
        if (!value || !value.metadata.labels || !value.metadata.name) {
            return;
        }
        var key = value.metadata.labels.app;
        insertToGroup(key, value);
    }

    function insertService(index, value) {
        if (!value || !value.spec.selector || !value.spec.selector.app || !value.metadata.name) {
            return;
        }
        var key = value.spec.selector.app;
        insertToGroup(key, value);
    }

    function insertDeployment(index, value) {
        if (!value || !value.spec.selector || !value.spec.selector.matchLabels || !value.spec.selector.matchLabels.app || !value.metadata.name) {
            return;
        }
        var key = value.spec.selector.matchLabels.app;
        insertToGroup(key, value);
    }

    function insertToGroup(key, value) {
        var list = groups[key];
        if (!list) {
            list = [];
            groups[key] = list;
        }
        list.push(value);
    }

    function groupByName() {
        // pods first. Important to calculate service placement.
        forEach(pods, insertPod);
        forEach(deployments, insertDeployment);
        forEach(services, insertService);
    }

    function matchesLabelQuery(labels, selector) {
        var match = true;
        forProperty(selector, function (key, value) {
            if (labels[key] !== value) {
                match = false;
            }
        });
        return match;
    }

    function makeGroupOrder() {
        var groupScores = {};

        var groupOrder = [];
        forProperty(groups, function (key, value) {
            groupOrder.push(key);
        });
        groupOrder.sort(function (a, b) { return groupScores[a] - groupScores[b]; });

        return groupOrder;
    }
})();
