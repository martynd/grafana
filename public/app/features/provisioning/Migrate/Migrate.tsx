import { useMemo } from 'react';

import { FeatureState } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, FeatureBadge, Spinner, Stack, Text } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { FoldersToMigrate } from './FoldersToMigrate';
import { OverviewStatCards } from './OverviewStatCards';
import { useFolderLeaderboard } from './hooks/useFolderLeaderboard';
import { aggregateFolderCounts, aggregateTotals, computeBreakdowns } from './stats';

function MigrateToGitopsHeader() {
  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h2" variant="h2">
          <Trans i18nKey="provisioning.migrate.header-title">Migrate to GitOps</Trans>
        </Text>
        <FeatureBadge featureState={FeatureState.experimental} />
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.migrate.header-subtitle">
          Manage your dashboards and folders like code — every change tracked, every update reviewed, every environment
          reproducible. Connect a Git repository to get started.
        </Trans>
      </Text>
    </Stack>
  );
}

/**
 * Migrate to GitOps tab. Shows an overview of how much of the instance is
 * already managed and how much progress has been made toward GitOps, plus the
 * list of unprovisioned folders and dashboards still to migrate. The
 * interactive migration workflow (quick wins, the migrate drawer) lands in
 * follow-up changes.
 */
export function Migrate() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();
  const {
    data: folders,
    isLoading: isLeaderboardLoading,
    isError: isLeaderboardError,
    isTruncated: isLeaderboardTruncated,
  } = useFolderLeaderboard();

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateTotals(breakdowns), [breakdowns]);
  const folderCounts = useMemo(() => aggregateFolderCounts(breakdowns), [breakdowns]);

  if (isLoading || isLeaderboardLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner />
        <Trans i18nKey="provisioning.migrate.loading">Loading stats...</Trans>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" title={t('provisioning.migrate.error-title', 'Failed to load provisioning stats')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (isLeaderboardError) {
    return (
      <Alert severity="error" title={t('provisioning.migrate.leaderboard-error-title', 'Failed to load folder list')}>
        <Trans i18nKey="provisioning.migrate.leaderboard-error-body">
          The Migrate page needs the folder leaderboard to figure out what to migrate. Refresh the page to try again.
        </Trans>
      </Alert>
    );
  }

  if (totals.instanceTotal === 0) {
    return (
      <Stack direction="column" gap={3}>
        <MigrateToGitopsHeader />
        <EmptyState variant="not-found" message={t('provisioning.migrate.empty', 'No provisioned resources yet')} />
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      {isLeaderboardTruncated && (
        <Alert
          severity="warning"
          title={t(
            'provisioning.migrate.leaderboard-truncated-title',
            'Showing a partial view of folders and dashboards'
          )}
        >
          <Trans i18nKey="provisioning.migrate.leaderboard-truncated-body">
            This instance has more folders or dashboards than this page can scan in one go. The list below covers a
            subset; migrate from it in batches and reload the page after each migration to surface the next batch.
          </Trans>
        </Alert>
      )}
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />
      <FoldersToMigrate folders={folders} />
    </Stack>
  );
}
