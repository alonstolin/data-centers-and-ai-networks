"""k-ary fat-tree topology generator (Al-Fares et al., SIGCOMM 2008)."""

from .topology import build_fattree, expected_counts

__all__ = ["build_fattree", "expected_counts"]
