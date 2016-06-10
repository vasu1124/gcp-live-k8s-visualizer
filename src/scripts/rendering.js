'use strict';

var CANVAS_NODES = '.nodesbar .canvas';
var CANVAS_CLUSTER = '.cluster .canvas';
var ENTITY_HEIGHT = 95;
var NODE_SPACE = 30;

var SRV_POD_SPACE_HOR = 190;
var SRV_POD_SPACE_VER = 40;

var DEPL_MIN_LEFT = 900;
var DEPL_POD_SPACE = 200;

var GROUP_VER = 40;

var LINE_WIDTH = 3;
var LINE_RADIUS = 3;

var COLORS_SVC = [
    '#009939',
    '#7A0063'
];
var COLORS_DPL = [
    '#3369E8',
    '#FFB521'
];

/**
 * Render all groups to the supplied jsPlumb instance.
 *
 * @param groups {Array} The array of groups.
 * @param jsPlumbInstance {Object} The jsPlumb instance
 */
function renderGroups(groups, jsPlumbInstance) {
    var canvas = document.querySelector(CANVAS_CLUSTER);
    var y = 0;

    forEach(groups, function (index, group) {
        var groupDiv = '<div class="group">';

        groupDiv += renderPods(group.pods, y);
        groupDiv += renderServices(group.services, y);
        groupDiv += renderDeployments(group.deployments, (group.pods ? group.pods.length : 0), y);

        groupDiv += '</div>';
        canvas.insertAdjacentHTML('beforeend', groupDiv);
        y += 2 * ENTITY_HEIGHT + SRV_POD_SPACE_VER + GROUP_VER;

        connectDeployments(group.deployments, group.pods, jsPlumbInstance);
        connectServices(group.services, group.pods, jsPlumbInstance);
    });


    function connectDeployments(deployments, pods, jsPlumbInstance) {
        forEach(deployments, function (i, deployment) {
            forEach(pods, function (j, pod) {
                if (extractVersion(deployment.spec.template.spec.containers[0].image) !== extractVersion(pod.spec.containers[0].image)) {
                    return;;
                }
                jsPlumbInstance.connect({
                    source: 'deployment-' + deployment.metadata.name,
                    target: 'pod-' + pod.metadata.name,
                    anchors: ['Bottom', 'Bottom'],
                    paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLORS_DPL[i & 1] },
                    endpointStyle: { fillStyle: COLORS_DPL[i & 1], radius: LINE_RADIUS }
                });
            });
        });
    }

    function connectServices(services, pods, jsPlumbInstance) {
        forEach(services, function (i, service) {
            forEach(pods, function (j, pod) {
                jsPlumbInstance.connect({
                    source: 'service-' + service.metadata.name,
                    target: 'pod-' + pod.metadata.name,
                    anchors: ['Bottom', 'Top'],
                    paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLORS_SVC[i & 1] },
                    endpointStyle: { fillStyle: COLORS_SVC[i & 1], radius: LINE_RADIUS }
                });
            });
        });
    }

    function renderPods(pods, y) {
        var x = 0;
        var renderedPods = '';
        forEach(pods, function (index, pod) {
            var name = pod.metadata.name;
            var version = pod.metadata.labels.version;
            var phase = pod.status.phase ? pod.status.phase.toLowerCase() : '';

            if ('deletionTimestamp' in pod.metadata) {
                phase = 'terminating';
            }

            var nodeName = pod.spec.nodeName;
            var podIp = pod.status.podIP;

            var entity =
                '<div class="window pod ' + phase + '" title="' + name + '" id="pod-' + name +
                '" style="left: ' + (x + SRV_POD_SPACE_HOR) + 'px; top: ' + (y + ENTITY_HEIGHT + SRV_POD_SPACE_VER) + 'px">' +
                '<span>' +
                "v." + extractVersion(pod.spec.containers[0].image) +
                (version ? "<br/>" + version : "") + "<br/><br/>" +
                (nodeName ? truncate(nodeName, 12) : "None") + "<br/><br/>" +
                (podIp ? "<em>" + podIp + "</em>" : "<em>" + phase + "</em>") +
                '</span>' +
                '</div>';
            renderedPods += entity;

            x += 130;
        });
        return renderedPods;
    }

    function renderServices(services, y) {
        var renderedServices = '';
        forEach(services, function (index, service) {
            var name = service.metadata.name;
            var version = service.metadata.labels.version;
            var phase = service.status.phase ? service.status.phase.toLowerCase() : '';
            var externalIps = service.spec.externalIPs;
            var clusterIp = service.spec.clusterIP;
            var loadBalancer = service.status.loadBalancer && service.status.loadBalancer.ingress ? service.status.loadBalancer.ingress[0].ip : undefined;

            var entity =
                '<div class="window wide service ' + phase + '" title="' + name + '" id="service-' + name + '" ' +
                'style="top: ' + y + 'px">' +
                '<span>' +
                '<div>' + name + '</div>' +
                (version ? "<br/>" + version : '') +
                (externalIps ? '<br/><br/><a href="http://' + externalIps[0] + ':' + service.spec.ports[0].port + '" target="_blank" rel="noreferrer nofollow">' + externalIps[0] + ':' + service.spec.ports[0].port + '</a>' : '') +
                (clusterIp ? '<br/><br/>' + clusterIp : '') +
                (loadBalancer ? '<br/><a href="http://' + loadBalancer + '" target="_blank" rel="noreferrer nofollow">' + loadBalancer + '</a>' : '') +
                '</span>' +
                '</div>';
            renderedServices += entity;
        });

        return renderedServices;
    }

    function renderDeployments(deployments, podsCount, y) {
        var renderedDeployments = '';

        forEach(deployments, function (index, deployment) {
            var name = deployment.metadata.name;
            var version = deployment.metadata.labels.version;
            var phase = deployment.status.phase ? deployment.status.phase.toLowerCase() : '';

            var x = getDeploymentLeftOffset(deployment, podsCount);

            var entity =
                '<div class="window wide deployment" title="' + name + '" id="deployment-' + name + '" ' +
                'style="left: ' + x + 'px; top: ' + (y + 130 + (index * 1.5 * ENTITY_HEIGHT)) + 'px">' +
                '<span>' +
                '<div>' + name + '</div>' +
                '<br/>' +
                '<div class="replicas">Replicas: ' + deployment.spec.replicas + "</div>" +
                (version ? "<br/>" + version : "") +
                '</span>' +
                '</div>';

            renderedDeployments += entity;
        });

        return renderedDeployments;
    }

    function getDeploymentLeftOffset(deployment, podsCount) {
        var calculatedReplicaLeft = DEPL_POD_SPACE + (deployment.status.replicas * 130);
        var calculatedPodsLeft = DEPL_POD_SPACE + (podsCount * 130);

        var left;
        if (DEPL_MIN_LEFT > calculatedReplicaLeft && DEPL_MIN_LEFT > calculatedPodsLeft) {
            left = DEPL_MIN_LEFT;
        } else if (calculatedReplicaLeft > DEPL_MIN_LEFT && calculatedReplicaLeft > calculatedPodsLeft) {
            left = calculatedReplicaLeft;
        } else {
            left = calculatedPodsLeft;
        }
        return left;
    }
}


function renderNodes(nodes) {
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
            '<img src="assets/providers/' + provider + '.png" class="provider-logo" />' +
            '<span><p class="nodetitle">Node</p><br/>' +
            truncate(node.metadata.name, 12) + '</span>' +
            '</a>' +
            '</div>';

        nodesbar.insertAdjacentHTML('beforeend', nodeElement);

        x += 93 + NODE_SPACE;
    });

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
}


