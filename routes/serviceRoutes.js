import express from 'express';
import Service from '../models/Service.js';
import { protect } from '../middleware/auth.js';
import { tenantIsolation } from '../middleware/tenantIsolation.js';

const router = express.Router();

// All routes require auth + tenant isolation
router.use(protect);
router.use(tenantIsolation);

// ── GET /api/services  — list all services for the org ──────────────────────
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    const filter = { organization: req.organizationId };

    if (search && search.trim() !== '') {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sacCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const services = await Service.find(filter).sort({ name: 1 });
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
});

// ── GET /api/services/:id  — get a single service ───────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Failed to fetch service' });
  }
});

// ── POST /api/services  — create a new service ──────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, sacCode, gstRate, rate, unit, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Service name is required' });
    }
    if (rate === undefined || rate === null || Number(rate) < 0) {
      return res.status(400).json({ message: 'Rate is required and must be 0 or greater' });
    }

    const service = new Service({
      organization: req.organizationId,
      name: name.trim(),
      sacCode: sacCode || '',
      gstRate: gstRate ?? 18,
      rate: Number(rate),
      unit: unit || 'NOS',
      description: description || '',
    });

    await service.save();
    res.status(201).json(service);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A service with this name already exists' });
    }
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Failed to create service' });
  }
});

// ── PUT /api/services/:id  — update a service ───────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, sacCode, gstRate, rate, unit, description, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Service name is required' });
    }

    const service = await Service.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      {
        name: name.trim(),
        sacCode: sacCode || '',
        gstRate: gstRate ?? 18,
        rate: Number(rate),
        unit: unit || 'NOS',
        description: description || '',
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A service with this name already exists' });
    }
    console.error('Error updating service:', error);
    res.status(500).json({ message: 'Failed to update service' });
  }
});

// ── DELETE /api/services/:id  — delete a service ────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findOneAndDelete({
      _id: req.params.id,
      organization: req.organizationId,
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Failed to delete service' });
  }
});

export default router;
