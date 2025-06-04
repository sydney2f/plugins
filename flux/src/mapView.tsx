import { Icon } from '@iconify/react';
import Deployment from '@kinvolk/headlamp-plugin/lib/K8s/deployment';
import DaemonSet from '@kinvolk/headlamp-plugin/lib/k8s/daemonSet';
import { useMemo } from 'react';
import { helmReleaseClass } from './helm-releases/HelmReleaseList';
import { FluxHelmReleaseDetailView } from './helm-releases/HelmReleaseSingle';
import { kustomizationClass } from './kustomizations/KustomizationList';
import { FluxKustomizationDetailView } from './kustomizations/KustomizationSingle';
import { helmRepositoryClass, ociRepositoryClass } from './sources/SourceList';
import { FluxSourceDetailView } from './sources/SourceSingle';

const HelmRelease = helmReleaseClass();
const HelmRepostory = helmRepositoryClass();
const OciSource = ociRepositoryClass();
const Kustomization = kustomizationClass();

export const makeKubeToKubeEdge = (from: any, to: any): any => ({
  id: `${from.metadata.uid}-${to.metadata.uid}`,
  source: from.metadata.uid,
  target: to.metadata.uid,
});

const HelmReleaseDetails = ({ node }) => (
  <FluxHelmReleaseDetailView
    name={node.kubeObject.jsonData.metadata.name}
    namespace={node.kubeObject.jsonData.metadata.namespace}
  />
);
const HelmRepositoryDetails = ({ node }) => (
  <FluxSourceDetailView
    pluralName="helmrepositories"
    name={node.kubeObject.jsonData.metadata.name}
    namespace={node.kubeObject.jsonData.metadata.namespace}
  />
);
const KustomizationDetails = ({ node }) => (
  <FluxKustomizationDetailView
    name={node.kubeObject.jsonData.metadata.name}
    namespace={node.kubeObject.jsonData.metadata.namespace}
  />
);
const OCIRepositoryDetails = ({ node }) => (
  <FluxSourceDetailView
    pluralName="ocirepositories"
    name={node.kubeObject.jsonData.metadata.name}
    namespace={node.kubeObject.jsonData.metadata.namespace}
  />
);

const helmRepositorySource: any = {
  id: 'flux-helm-repository',
  label: 'Helm Repository',
  icon: <Icon icon="simple-icons:flux" width="100%" height="100%" color="rgb(50, 108, 229)" />,
  useData() {
    const [repositories] = HelmRepostory.useList();
    const [releases] = HelmRelease.useList();

    return useMemo(() => {
      if (!repositories || !releases) return null;

      const nodes = repositories?.map(it => ({
        id: it.metadata.uid,
        kubeObject: it,
        detailsComponent: HelmRepositoryDetails,
      }));
      const edges: any[] = [];

      repositories?.forEach(repo => {
        const { name } = repo.metadata;

        const release = releases?.find(
          it =>
            it.jsonData.spec?.chart?.spec?.sourceRef?.kind === 'HelmRepository' &&
            it.jsonData.spec?.chart?.spec?.sourceRef?.name === name
        );

        if (release) {
          edges.push(makeKubeToKubeEdge(release, repo));
        }
      });

      return {
        nodes,
        edges,
      };
    }, [repositories, releases]);
  },
};

const helmReleaseSource = {
  id: 'flux-helm-releases',
  label: 'Helm Release',
  icon: <Icon icon="simple-icons:flux" width="100%" height="100%" color="rgb(50, 108, 229)" />,
  useData() {
    const [deployments] = Deployment.useList();
    const [releases] = HelmRelease.useList();
    const [daemonsets] = DaemonSet.useList();

    return useMemo(() => {
      if (!deployments || !releases) return null;

      const nodes = releases?.map(it => ({
        id: it.metadata.uid,
        kubeObject: it,
        detailsComponent: HelmReleaseDetails,
      }));

      const edges: any[] = [];

      releases?.forEach(release => {
        const { name, namespace } = release.metadata;

        const deployment = deployments?.filter(
          d =>
            d.metadata.labels?.['helm.toolkit.fluxcd.io/name'] === name &&
            d.metadata.labels?.['helm.toolkit.fluxcd.io/namespace'] === namespace
        ).forEach ( currdeployment => {
          edges.push(makeKubeToKubeEdge(release, currdeployment));
        })

        const daemonset = daemonsets?.filter(
          ds =>
            ds.metadata.labels?.['helm.toolkit.fluxcd.io/name'] === name &&
            ds.metadata.labels?.['helm.toolkit.fluxcd.io/namespace'] === namespace
        ).forEach ( currdaemonset => {
          edges.push(makeKubeToKubeEdge(release, currdaemonset));
        })
      });

      return {
        nodes,
        edges,
      };
    }, [deployments, releases, daemonsets]);
  },
};


const kustomizationSource = {
  id: 'flux-kustomization',
  label: 'Kustomizations',
  icon: <Icon icon="simple-icons:flux" width="100%" height="100%" color="rgb(50, 108, 229)" />,
  useData() {
    const [deployments] = Deployment.useList();
    const [kustomizations] = Kustomization.useList();
    const [releases] = HelmRelease.useList();

    return useMemo(() => {
      if (!deployments || !kustomizations || !releases) return null;

      const nodes = kustomizations?.map(it => ({
        id: it.metadata.uid,
        kubeObject: it,
        detailsComponent: KustomizationDetails,
      }));

      const edges: any[] = [];

      kustomizations?.forEach(kustom => {
        const { name, namespace } = kustom.metadata;

        // Kustomization → Deployment
        deployments
          ?.filter(
            it =>
              it.metadata.labels?.['kustomize.toolkit.fluxcd.io/name'] === name &&
              it.metadata.labels?.['kustomize.toolkit.fluxcd.io/namespace'] === namespace
          )
          .forEach(deployment => {
            edges.push(makeKubeToKubeEdge(kustom, deployment));
          });

        // Kustomization → HelmRelease (via label match)
        releases
          ?.filter(
            it =>
              it.metadata.labels?.['kustomize.toolkit.fluxcd.io/name'] === name &&
              it.metadata.labels?.['kustomize.toolkit.fluxcd.io/namespace'] === namespace
          )
          .forEach(helmRelease => {
            edges.push(makeKubeToKubeEdge(kustom, helmRelease));
          });
      });

      return {
        nodes,
        edges,
      };
    }, [deployments, kustomizations, releases]);
  },
};

const ociSource = {
  id: 'flex-oci-source',
  label: 'OCI Source',
  icon: <Icon icon="simple-icons:flux" width="100%" height="100%" color="rgb(50, 108, 229)" />,
  isEnabledByDefault: false,
  useData() {
    const [kustomizations] = Kustomization.useList();
    const [ocisources] = OciSource.useList();

    return useMemo(() => {
      if (!kustomizations || !ocisources) return null;
      const nodes = ocisources?.map(it => ({
        id: it.metadata.uid,
        kubeObject: it,
        detailsComponent: OCIRepositoryDetails,
      }));
      const edges = [];

      ocisources?.forEach(release => {
        const { name } = release.metadata;

        kustomizations
          ?.filter(
            it =>
              it.jsonData.spec?.sourceRef?.kind === 'OCIRepository' &&
              it.jsonData.spec?.sourceRef?.name === name
          )
          .forEach(deployment => {
            edges.push(makeKubeToKubeEdge(release, deployment));
          });
      });

      return {
        nodes,
        edges,
      };
    }, [kustomizations, ocisources]);
  },
};

export const fluxSource = {
  id: 'flux',
  label: 'Flux',
  icon: <Icon icon="simple-icons:flux" width="100%" height="100%" color="rgb(50, 108, 229)" />,
  sources: [helmReleaseSource, helmRepositorySource, kustomizationSource, ociSource],
};
