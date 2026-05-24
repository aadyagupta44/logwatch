import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Real-time Anomaly Detection',
    description: (
      <>
        Detect anomalies in your log streams within seconds. LogWatch's Rust engine
        processes logs through 60-second sliding windows and flags deviations the
        moment they occur.
      </>
    ),
  },
  {
    title: 'ML-powered, Zero Config',
    description: (
      <>
        An ONNX IsolationForest model runs entirely in the Rust engine — no Python
        at runtime, no manual threshold tuning. Add the SDK, ship your API key, and
        anomaly detection starts immediately.
      </>
    ),
  },
  {
    title: 'Multi-service Visibility',
    description: (
      <>
        Monitor every microservice from a single dashboard. Per-service severity
        timelines, acknowledgement workflows, and a live anomaly feed give your team
        full situational awareness.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
