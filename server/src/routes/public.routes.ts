import { Router } from 'express';
import { branding, health } from '../controllers/public.controller';

const router = Router();

router.get('/health', health);
router.get('/branding', branding);

export default router;
