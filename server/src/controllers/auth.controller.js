import * as authService from '../services/auth.service.js';

export async function signup(req, res) {
  const session = await authService.signup(req.body);
  res.status(201).json(session);
}

export async function login(req, res) {
  const session = await authService.login(req.body);
  res.json(session);
}

export async function me(req, res) {
  const session = await authService.getCurrentSession(req.user.tenantId, req.user.id);
  res.json(session);
}
