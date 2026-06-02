import { render, screen } from 'test/test-utils';

import { type ResourceStats, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { Migrate } from './Migrate';
import { type FolderRow, useFolderLeaderboard } from './hooks/useFolderLeaderboard';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetResourceStatsQuery: jest.fn(),
}));

jest.mock('./hooks/useFolderLeaderboard', () => ({
  useFolderLeaderboard: jest.fn(),
}));

const mockUseGetResourceStatsQuery = jest.mocked(useGetResourceStatsQuery);
const mockUseFolderLeaderboard = jest.mocked(useFolderLeaderboard);

const folders: FolderRow[] = [
  {
    uid: 'unmanaged-folder',
    title: 'Unmanaged Folder',
    dashboardCount: 2,
    directDashboards: [
      { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
      { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
    ],
    subfolders: [],
    allDashboards: [
      { uid: 'd1', title: 'Dashboard One', url: '/d/d1' },
      { uid: 'd2', title: 'Dashboard Two', url: '/d/d2' },
    ],
  },
  {
    uid: 'managed-folder',
    title: 'Managed Folder',
    managedBy: 'repo',
    dashboardCount: 3,
    directDashboards: [],
    subfolders: [],
    allDashboards: [],
  },
];

function mockLeaderboard(overrides: Partial<ReturnType<typeof useFolderLeaderboard>> = {}) {
  mockUseFolderLeaderboard.mockReturnValue({
    data: folders,
    isLoading: false,
    isError: false,
    isTruncated: false,
    ...overrides,
  });
}

// 100 dashboards total, 40 managed by Git Sync, 10 by Terraform => 50 managed,
// 50 unmanaged. 8 folders total, 6 managed (4 git sync + 2 terraform).
const stats: ResourceStats = {
  instance: [
    { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
    { group: 'folder.grafana.app', resource: 'folders', count: 8 },
  ],
  managed: [
    {
      kind: 'repo',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
        { group: 'folder.grafana.app', resource: 'folders', count: 4 },
      ],
    },
    {
      kind: 'terraform',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
    },
  ],
};

function mockQuery(overrides: Partial<ReturnType<typeof useGetResourceStatsQuery>>) {
  mockUseGetResourceStatsQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: undefined,
    refetch: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useGetResourceStatsQuery>);
}

describe('Migrate', () => {
  beforeEach(() => {
    mockLeaderboard();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a loading spinner while stats are loading', () => {
    mockQuery({ isLoading: true });

    render(<Migrate />);

    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders a loading spinner while the folder leaderboard is loading', () => {
    mockQuery({ data: stats });
    mockLeaderboard({ isLoading: true });

    render(<Migrate />);

    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert when the folder leaderboard fails', () => {
    mockQuery({ data: stats });
    mockLeaderboard({ isError: true });

    render(<Migrate />);

    expect(screen.getByText(/failed to load folder list/i)).toBeInTheDocument();
  });

  it('renders a truncation warning when the leaderboard is truncated', () => {
    mockQuery({ data: stats });
    mockLeaderboard({ isTruncated: true });

    render(<Migrate />);

    expect(screen.getByText(/partial view of folders and dashboards/i)).toBeInTheDocument();
  });

  it('renders an error alert when the stats query fails', () => {
    mockQuery({ isError: true, error: { message: 'boom' } });

    render(<Migrate />);

    expect(screen.getByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders an empty state when there are no dashboards', () => {
    mockQuery({ data: { instance: [], managed: [] } });

    render(<Migrate />);

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/no provisioned resources yet/i)).toBeInTheDocument();
  });

  describe('with stats', () => {
    beforeEach(() => {
      mockQuery({ data: stats });
    });

    it('renders the header with an experimental badge', () => {
      render(<Migrate />);

      expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
      expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
    });

    it('renders the five overview cards with the expected values', () => {
      render(<Migrate />);

      // Total dashboards card.
      expect(screen.getByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();

      // Managed dashboards: 50 of 100 => 50%.
      expect(screen.getByText('Managed dashboards')).toBeInTheDocument();

      // Unmanaged dashboards: 50 of 100 => 50%.
      expect(screen.getByText('Unmanaged dashboards')).toBeInTheDocument();

      // Both managed and unmanaged report "50 of 100 dashboards".
      expect(screen.getAllByText('50 of 100 dashboards')).toHaveLength(2);

      // Progress to GitOps: 40 of 100 => 40%, "40 via Git Sync".
      expect(screen.getByText('Progress to GitOps')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('40 via Git Sync')).toBeInTheDocument();

      // Two cards show 50% (managed + unmanaged).
      expect(screen.getAllByText('50%')).toHaveLength(2);
    });

    it('renders the folders managed gauge with managed/total and percentage', () => {
      render(<Migrate />);

      expect(screen.getByText('Folders managed')).toBeInTheDocument();
      // 6 of 8 folders managed (4 git sync + 2 terraform).
      expect(screen.getByText('6 / 8')).toBeInTheDocument();
      // 6 / 8 => 75%.
      expect(screen.getByText('75% complete')).toBeInTheDocument();
    });

    it('renders unmanaged folders in the table and hides managed ones', () => {
      render(<Migrate />);

      expect(screen.getByText('Dashboards to migrate')).toBeInTheDocument();
      expect(screen.getByText('Unmanaged Folder')).toBeInTheDocument();
      expect(screen.queryByText('Managed Folder')).not.toBeInTheDocument();
      expect(screen.getByText('Showing 1 of 1 folders')).toBeInTheDocument();
    });

    it('expands a folder to reveal its dashboards', async () => {
      const { user } = render(<Migrate />);

      // Dashboards are hidden until the folder is expanded.
      expect(screen.queryByText('Dashboard One')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /expand unmanaged folder/i }));

      expect(screen.getByText('Dashboard One')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Two')).toBeInTheDocument();
    });
  });
});
