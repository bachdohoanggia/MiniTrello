import { supabase } from '../supabaseClient';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase configuration is missing.');
  return supabase;
}

async function rpc(name, params = {}) {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) throw error;
  return data;
}

export const ensureCurrentUser = () => rpc('ensure_current_user');
export const fetchUserDashboard = () => rpc('get_user_dashboard');
export const fetchWorkspaceContext = (workspaceId) => rpc('get_workspace_context', {
  p_workspace_id: workspaceId,
});
export const createWorkspace = (name) => rpc('create_workspace', {
  p_name: name,
});
export const renameWorkspace = (workspaceId, name) => rpc('rename_workspace', {
  p_workspace_id: workspaceId,
  p_name: name,
});
export const joinWorkspace = (code) => rpc('join_workspace', {
  p_join_code: code,
});
export const updateUserProfile = (displayName) => rpc('update_user_profile', {
  p_display_name: displayName,
});
export const selectGoogleLoginIdentity = (identityId) => rpc('select_google_login_identity', {
  p_identity_id: identityId,
});
export const addWorkspaceMember = (workspaceId, targetEmail, role) =>
  rpc('add_workspace_member', {
    p_workspace_id: workspaceId,
    p_target_email: targetEmail,
    p_role: role,
  });
export const changeWorkspaceMemberRole = (workspaceId, targetUserId, role) =>
  rpc('change_workspace_member_role', {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId,
    p_role: role,
  });
export const removeWorkspaceMember = (workspaceId, targetUserId) =>
  rpc('remove_workspace_member', {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId,
  });
export const deleteWorkspace = (workspaceId) => rpc('delete_workspace', {
  p_workspace_id: workspaceId,
});
