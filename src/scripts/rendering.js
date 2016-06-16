/* global extractVersion, truncate */
const CANVAS_NODES = '.nodesbar .canvas';
const CANVAS_CLUSTER = '.cluster .canvas';
const ENTITY_HEIGHT = 95;
const NODE_SPACE = 30;

const SRV_POD_SPACE_HOR = 190;

const DEPL_MIN_LEFT = 900;
const DEPL_POD_SPACE = 200;

const GROUP_VER = 10;
const GROUP_LAYER_VER = -10;

const LINE_WIDTH = 3;
const LINE_RADIUS = 3;

const COLORS_SVC = [
    '#009939',
    '#7A0063',
];
const COLORS_DPL = [
    '#3369E8',
    '#FFB521',
];

/**
 * Render all groups to the supplied jsPlumb instance.
 *
 * @param groups {Array} The array of groups.
 * @param jsPlumbInstance {Object} The jsPlumb instance
 */
function renderGroups(groups, jsPlumbInstance) {
    const canvas = document.querySelector(CANVAS_CLUSTER);
    let y = 0;
    groups.forEach(group => {
        let groupDiv = '<div class="group">';

        if (group.services) {
            groupDiv += renderServices(group.services, y);
            y += group.services.length * 1.1 * ENTITY_HEIGHT + GROUP_LAYER_VER;
        }
        if (group.pods) {
            groupDiv += renderPods(group.pods, y);
            y += ENTITY_HEIGHT + GROUP_LAYER_VER;
        }
        if (group.deployments) {
            groupDiv += renderDeployments(group.deployments, group.pods, y);
            y += group.deployments.length * 1.1 * ENTITY_HEIGHT + GROUP_LAYER_VER;
        }

        groupDiv += '</div>';
        canvas.insertAdjacentHTML('beforeend', groupDiv);

        y += GROUP_VER;

        if (!group.pods) {
            return;
        }

        if (group.deployments) {
            connectDeployments(group.deployments, group.pods, jsPlumbInstance);
        }

        if (group.services) {
            connectServices(group.services, group.pods, jsPlumbInstance);
        }
    });
    canvas.setAttribute('style', `height: ${y}px`);
}

function renderPods(pods, y) {
    let x = 0;
    let renderedPods = '';
    pods.forEach(pod => {
        const name = pod.metadata.name;
        const version = pod.metadata.labels.version;
        let phase = pod.status.phase ? pod.status.phase.toLowerCase() : '';

        if ('deletionTimestamp' in pod.metadata) {
            phase = 'terminating';
        }

        const nodeName = pod.spec.nodeName;
        const podIp = pod.status.podIP;

        const entity =
            `<div class="window pod ${phase}" title="${name}" id="pod-${name}"
            style="left: ${x + SRV_POD_SPACE_HOR}px; top: ${y}px">
            <span>
            v.${extractVersion(pod.spec.containers[0].image)}
            ${version ? `<br/>${version}` : ''}<br/><br/>
            ${nodeName ? truncate(nodeName, 12) : 'None'}<br/><br/>
            ${podIp ? `<em>${podIp}</em>` : `<em>${phase}</em>`}
            </span>
            </div>`;
        renderedPods += entity;

        x += 130;
    });
    return renderedPods;
}

function renderServices(services, yOffset) {
    let renderedServices = '';
    services.forEach((service, index) => {
        const name = service.metadata.name;
        const version = service.metadata.labels.version;
        const phase = service.status.phase ? service.status.phase.toLowerCase() : '';
        const externalIps = service.spec.externalIPs ? `${service.spec.externalIPs[0]}:${service.spec.ports[0].port}` : undefined;
        const clusterIp = service.spec.clusterIP;
        const loadBalancer = service.status.loadBalancer && service.status.loadBalancer.ingress ? service.status.loadBalancer.ingress[0].ip : undefined;
        const y = yOffset + index * 1.1 * ENTITY_HEIGHT;

        const entity =
            `<div class="window wide service ${phase}" title="${name}" id="service-${name}" style="top: ${y}px">
            <span>
            <div>${name}</div>
            ${version ? `<br/>${version}` : ''}
            ${externalIps ? `<br/><br/><a href="http://${externalIps}" target="_blank" rel="noreferrer nofollow">${externalIps}</a>` : ''}
            ${clusterIp ? `<br/><br/>${clusterIp}` : ''}
            ${loadBalancer ? `<br/><a href="http://${loadBalancer}" target="_blank" rel="noreferrer nofollow">${loadBalancer}</a>` : ''}
            </span>
            </div>`;
        renderedServices += entity;
    });

    return renderedServices;
}

function renderDeployments(deployments, pods, yOffset) {
    let renderedDeployments = '';
    const podsCount = pods ? pods.length : 0;

    deployments.forEach((deployment, index) => {
        const name = deployment.metadata.name;
        const version = deployment.metadata.labels.version;
        const phase = deployment.status.phase ? deployment.status.phase.toLowerCase() : '';

        const x = getDeploymentLeftOffset(deployment, podsCount);
        const y = yOffset + index * 1.1 * ENTITY_HEIGHT;

        const entity =
            `<div class="window wide deployment ${phase}" title="${name}" id="deployment-${name}"
            style="left: ${x}px; top: ${y}px">
            <span>
            <div>${name}</div>
            <br/>
            <div class="replicas">Replicas: ${deployment.spec.replicas}</div>
            ${version ? `<br/>${version}` : ''}
            </span>
            </div>`;

        renderedDeployments += entity;
    });

    return renderedDeployments;
}

function getDeploymentLeftOffset(deployment, podsCount) {
    const calculatedReplicaLeft = DEPL_POD_SPACE + (deployment.status.replicas * 130);
    const calculatedPodsLeft = DEPL_POD_SPACE + (podsCount * 130);

    let left;
    if (DEPL_MIN_LEFT > calculatedReplicaLeft && DEPL_MIN_LEFT > calculatedPodsLeft) {
        left = DEPL_MIN_LEFT;
    } else if (calculatedReplicaLeft > DEPL_MIN_LEFT && calculatedReplicaLeft > calculatedPodsLeft) {
        left = calculatedReplicaLeft;
    } else {
        left = calculatedPodsLeft;
    }
    return left;
}

function connectDeployments(deployments, pods, jsPlumbInstance) {
    deployments.forEach((deployment, i) => {
        pods.forEach(pod => {
            if (extractVersion(deployment.spec.template.spec.containers[0].image) !== extractVersion(pod.spec.containers[0].image)) {
                return;
            }
            jsPlumbInstance.connect({
                source: `deployment-${deployment.metadata.name}`,
                target: `pod-${pod.metadata.name}`,
                anchors: ['Left', 'Bottom'],
                paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLORS_DPL[i & 1] },
                endpointStyle: { fillStyle: COLORS_DPL[i & 1], radius: LINE_RADIUS },
            });
        });
    });
}

function connectServices(services, pods, jsPlumbInstance) {
    services.forEach((service, i) => {
        pods.forEach(pod => {
            if (!matchObjects(pod.metadata.labels, service.spec.selector)) {
                return;
            }

            jsPlumbInstance.connect({
                source: `service-${service.metadata.name}`,
                target: `pod-${pod.metadata.name}`,
                anchors: ['Right', 'Top'],
                paintStyle: { lineWidth: LINE_WIDTH, strokeStyle: COLORS_SVC[i & 1] },
                endpointStyle: { fillStyle: COLORS_SVC[i & 1], radius: LINE_RADIUS },
            });
        });
    });
}

/**
 * Get Node provider from provider ID.
 * Default to RaspberryPi.
 *
 * @param {Object} node The node.
 * @returns Identified provider name or 'pi'.
 */
function getNodeProvider(node) {
    if (!node || !node.spec || !node.spec.providerID) {
        return 'pi';
    }

    const provider = node.spec.providerID.split(':')[0];
    switch (provider) {
    case 'gce':
        return 'gce';
    default:
        return 'pi';
    }
}

/**
 * Render cluster nodes.
 */
function renderNodes(nodes) {
    let x = 0;
    const nodesbar = document.querySelector(CANVAS_NODES);

    nodes.forEach(node => {
        let ready;
        for (let j = 0; j < node.status.conditions.length; j++) {
            const condition = node.status.conditions[j];

            if (condition.type === 'Ready') {
                ready = (condition.status === 'True' ? 'ready' : 'not-ready');
                break;
            }
        }

        const provider = getNodeProvider(node);

        const nodeElement =
            `<div>
            <a href="http://${node.metadata.name}:4194/"
            target="_blank" rel="noreferrer nofollow"
            id="node-${node.metadata.name}"
            class="window node ${ready}"
            title="${node.metadata.name}"
            style="left: ${x}px">
            <img src="assets/providers/${provider}.png" class="provider-logo" />
            <span><p class="nodetitle">Node</p><br/>
            ${truncate(node.metadata.name, 12)}</span>
            </a>
            </div>`;

        nodesbar.insertAdjacentHTML('beforeend', nodeElement);

        x += 93 + NODE_SPACE;
    });
}

/**
 * Hide error notification.
 * @param {HTMLElement} element The element.
 */
function hideError(element) {
    if (element.classList.contains('hide')) {
        return;
    }

    addClass(element, 'hide');
}

/**
 * Show error notification.
 * @param {HTMLElement} element The element.
 * @param {Object} error Error object.
 */
function showError(element, errorObject) {
    removeClass(element, 'hide');
    if (errorObject) {
        const messageElement = element.getElementsByClassName('message')[0];
        if (errorObject.error) {
            messageElement.innerHTML = 'No connection';
        } else if (errorObject.timeout) {
            messageElement.innerHTML = 'Timeout exceeded';
        } else {
            messageElement.innerHTML = `${errorObject.httpRequest.status}: ${errorObject.httpRequest.statusText}`;
        }
    }
}

/**
 * Remove class from element.
 * @param {HTMLElement} element The element.
 * @param {string} className The class name to remove.
 */
function removeClass(element, className) {
    element.className = element.className.replace(new RegExp(`(?:^|\\s)${className}(?!\\S)`), '');
}

/**
 * Add class to element.
 * @param {HTMLElement} element The element.
 * @param {string} className The class name to add.
 */
function addClass(element, className) {
    element.className = `${element.className} ${className}`;
}
