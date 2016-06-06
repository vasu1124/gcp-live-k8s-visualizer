## Kubernetes/Container Engine Visualizer

This is a simple visualizer for use with the Kubernetes API.

### Usage:
   * First install a Kubernetes or Container Engine Cluster
   * Clone this repository
   * Run `kubectl proxy -w=path/to/gcp-live-k8s-visualizer`

### Prerequisites
The visualizer uses labels to organize the visualization.

To enable visualization of kubernetes entities set `visualize` to `true`.

  * Pods are identified with the label `app`.

  * Services by a selector property named `app`.

  * Deployments by their template label `app`.

Here follows minimized `.yaml` files to show the configuration.

Service configuration

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hello-kubernetes-svc
  labels:
    visualize: "true"
spec:
  selector:
    app: hello-kubernetes-pod
```

Deployment configuration

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: hello-kubernetes-deployment
  labels:
    visualize: "true"
spec:
  template:
    metadata:
      labels:
        app: hello-kubernetes-pod
        visualize: "true"
```
