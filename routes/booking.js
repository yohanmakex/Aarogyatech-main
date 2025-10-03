/*
 * AarogyaTech - AI-powered Mental Health Assistant
 * Booking API Routes - Counseling appointment management endpoints
 * 
 * Copyright (c) 2025 Rajiv Magadum
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * Author: Rajiv Magadum
 * Email: rajiv.magadum@gmail.com
 * Date: 2025
 */

const express = require('express');
const ErrorHandlingMiddleware = require('../middleware/errorHandlingMiddleware');
const BookingService = require('../services/bookingService');

const router = express.Router();
const bookingService = new BookingService();
const errorMiddleware = new ErrorHandlingMiddleware();
const { wrapAsyncRoute } = errorMiddleware.getMiddleware();

/**
 * POST /api/booking/appointments
 * Create a new counseling appointment booking
 */
router.post('/appointments', wrapAsyncRoute(async (req, res) => {
  try {
    const {
      studentId,
      preferredDate,
      preferredTime,
      sessionType,
      concerns,
      contactMethod,
      contactInfo,
      userId = null
    } = req.body;

    // Validate required fields
    if (!preferredDate || !preferredTime || !sessionType || !contactMethod || !contactInfo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required fields: preferredDate, preferredTime, sessionType, contactMethod, contactInfo'
      });
    }

    // Validate session type
    const validSessionTypes = ['individual', 'group', 'crisis'];
    if (!validSessionTypes.includes(sessionType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid session type. Must be: individual, group, or crisis'
      });
    }

    // Validate contact method
    const validContactMethods = ['email', 'phone', 'campus-message'];
    if (!validContactMethods.includes(contactMethod)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid contact method. Must be: email, phone, or campus-message'
      });
    }

    // Validate date is not in the past
    const bookingDate = new Date(preferredDate + 'T' + preferredTime);
    if (bookingDate <= new Date()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Booking date and time must be in the future'
      });
    }

    // Create booking request
    const bookingRequest = {
      studentId: studentId || null,
      userId: userId || req.user?.id || null,
      preferredDate,
      preferredTime,
      sessionType,
      concerns: concerns || null,
      contactMethod,
      contactInfo,
      status: 'pending',
      requestedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    // Save booking
    const booking = await bookingService.createBooking(bookingRequest);

    // Record analytics for booking submission
    if (req.app.locals.analyticsService) {
      const userId = bookingRequest.userId || `anonymous_${Buffer.from(bookingRequest.ipAddress).toString('base64').substring(0, 12)}`;
      
      req.app.locals.analyticsService.recordUserInteraction(userId, {
        sessionId: booking.id,
        type: 'booking',
        messageLength: (concerns || '').length,
        responseTime: 0,
        sentiment: null,
        topics: ['booking', 'counseling', sessionType],
        crisisDetected: sessionType === 'crisis',
        language: req.headers['accept-language'] || 'en',
        success: true,
        statusCode: 201,
        endpoint: '/api/booking/appointments',
        method: 'POST'
      });
    }

    // Send confirmation response
    res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully',
      booking: {
        id: booking.id,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        sessionType: booking.sessionType,
        status: booking.status,
        requestedAt: booking.requestedAt
      },
      nextSteps: [
        'Your request has been received and is being processed',
        'You will be contacted within 24 hours to confirm your appointment',
        `Confirmation will be sent via ${contactMethod}`,
        'If this is a crisis situation, please also call 988 for immediate support'
      ]
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/booking/appointments/:id
 * Get booking details by ID
 */
router.get('/appointments/:id', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await bookingService.getBookingById(id);
    
    if (!booking) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      booking: booking
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * PUT /api/booking/appointments/:id/status
 * Update booking status (for admin/counselor use)
 */
router.put('/appointments/:id/status', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedCounselor, scheduledDateTime } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status. Must be: pending, confirmed, cancelled, or completed'
      });
    }

    const booking = await bookingService.updateBookingStatus(id, {
      status,
      notes: notes || null,
      assignedCounselor: assignedCounselor || null,
      scheduledDateTime: scheduledDateTime || null,
      updatedAt: new Date()
    });

    if (!booking) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      booking: booking
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/booking/appointments
 * Get bookings (with filtering options)
 */
router.get('/appointments', wrapAsyncRoute(async (req, res) => {
  try {
    const {
      status,
      sessionType,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      status: status || null,
      sessionType: sessionType || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null
    };

    const bookings = await bookingService.getBookings(filters, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      bookings: bookings.items,
      pagination: {
        total: bookings.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: bookings.total > (parseInt(offset) + bookings.items.length)
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/booking/availability
 * Get available time slots for booking
 */
router.get('/availability', wrapAsyncRoute(async (req, res) => {
  try {
    const { date, sessionType } = req.query;

    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Date parameter is required'
      });
    }

    const availability = await bookingService.getAvailability(date, sessionType);

    res.status(200).json({
      success: true,
      date: date,
      sessionType: sessionType || 'any',
      availableSlots: availability.slots,
      unavailableSlots: availability.unavailableSlots,
      totalSlots: availability.totalSlots,
      availableCount: availability.availableCount
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * DELETE /api/booking/appointments/:id
 * Cancel a booking
 */
router.delete('/appointments/:id', wrapAsyncRoute(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await bookingService.cancelBooking(id, {
      reason: reason || 'Cancelled by user',
      cancelledAt: new Date()
    });

    if (!booking) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking.id,
        status: booking.status,
        cancelledAt: booking.cancelledAt
      }
    });

  } catch (error) {
    throw error;
  }
}));

/**
 * GET /api/booking/stats
 * Get booking statistics for analytics
 */
router.get('/stats', wrapAsyncRoute(async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const stats = await bookingService.getBookingStats({
      dateFrom: dateFrom || null,
      dateTo: dateTo || null
    });

    res.status(200).json({
      success: true,
      stats: stats,
      period: {
        from: dateFrom || 'all time',
        to: dateTo || 'now'
      }
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;