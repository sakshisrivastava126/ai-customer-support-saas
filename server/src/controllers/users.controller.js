import * as userService from '../services/user.service.js';

export async function createUser(req, res) {
  const user = await userService.createStaffUser(req.user.tenantId, req.body);
  res.status(201).json({ user });
}
