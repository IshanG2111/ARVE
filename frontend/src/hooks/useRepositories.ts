import { useQuery } from '@tanstack/react-query';
import { getGitHubRepos, getBranches, getBranchesByFullName } from '../services/api';

export function useGitHubRepos() {
  return useQuery({
    queryKey: ['github-repos'],
    queryFn: getGitHubRepos,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBranches(repoId: string | null) {
  return useQuery({
    queryKey: ['branches', repoId],
    queryFn: () => getBranches(repoId!),
    enabled: !!repoId,
  });
}

export function useBranchesByName(fullName: string | null) {
  return useQuery({
    queryKey: ['branches-by-name', fullName],
    queryFn: () => getBranchesByFullName(fullName!),
    enabled: !!fullName,
    staleTime: 1000 * 60 * 2,
  });
}
