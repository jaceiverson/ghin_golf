from matplotlib import pyplot as plt


def plot_history(history_data: dict) -> None:
    """Plot the handicap history"""
    plt.plot(history_data)
