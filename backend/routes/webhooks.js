const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const User = require('../models/User');
const Token = require('../models/Token');

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    case 'charge.dispute.created':
      await handleDisputeCreated(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id
    });

    if (!payment) {
      console.error('Payment not found for payment intent:', paymentIntent.id);
      return;
    }

    if (payment.status === 'succeeded') {
      console.log('Payment already processed:', paymentIntent.id);
      return;
    }

    // Update payment status
    payment.status = 'succeeded';
    await payment.save();

    // Add tokens to user
    const user = await User.findById(payment.user);
    if (user) {
      user.tokens += payment.tokens;
      await user.save();

      // Create token transaction record
      const tokenTransaction = new Token({
        user: payment.user,
        type: 'purchase',
        amount: payment.tokens,
        description: `Purchased ${payment.tokens} tokens via Stripe`,
        paymentId: payment._id,
        metadata: {
          paymentIntentId: paymentIntent.id,
          amount: payment.amount,
          currency: payment.currency
        }
      });

      await tokenTransaction.save();

      console.log(`Payment successful: ${payment.tokens} tokens added to user ${user._id}`);
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent) {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id
    });

    if (payment) {
      payment.status = 'failed';
      await payment.save();
      console.log(`Payment failed: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Handle dispute
async function handleDisputeCreated(dispute) {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: dispute.payment_intent
    });

    if (payment) {
      payment.status = 'disputed';
      await payment.save();
      console.log(`Payment disputed: ${dispute.payment_intent}`);
    }
  } catch (error) {
    console.error('Error handling dispute:', error);
  }
}

module.exports = router; 