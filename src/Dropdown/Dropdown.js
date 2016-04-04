import classNames from 'classnames';
import GeminiScrollbar from 'react-gemini-scrollbar';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import BindMixin from '../Mixin/BindMixin';
import DOMUtil from '../Util/DOMUtil';
import KeyDownMixin from '../Mixin/KeyDownMixin';
import Util from '../Util/Util';

class Dropdown extends Util.mixin(BindMixin, KeyDownMixin) {
  get methodsToBind() {
    return [
      'handleMenuToggle',
      'handleExternalClick',
      'handleWrapperBlur'
    ];
  }

  get keysToBind() {
    return {
      esc: this.handleExternalClick
    };
  }

  constructor() {
    super();
    this.state = {
      maxDropdownHeight: null,
      menuDirection: 'down',
      menuHeight: null,
      isOpen: false,
      selectedID: null
    };
  }

  componentWillMount() {
    super.componentWillMount(...arguments);

    let props = this.props;
    if (!props.persistentID) {
      this.setState({selectedID: props.initialID});
    }
  }

  componentDidUpdate() {
    super.componentDidUpdate(...arguments);

    // If we don't know the menu height already, we need to calculate it after
    // it's rendered. It's rendered inside a concealed container, so it's okay
    // if it renders in the wrong direction.
    if (this.state.menuHeight == null &&
      this.refs.dropdownMenuConcealer != null) {
      let dropdownMenuConcealer = this.refs.dropdownMenuConcealer;
      let {maxDropdownHeight, menuDirection, menuHeight} = this.state;

      if (dropdownMenuConcealer != null) {
        // Get the height and direction of the concealed menu.
        menuHeight = dropdownMenuConcealer.firstChild.clientHeight || 0;
        let menuStyle = this.getOptimalMenuStyle(menuHeight);

        menuDirection = menuStyle.direction;
        maxDropdownHeight = menuStyle.height;
      }

      // Setting state with menu height and direction will re-render the
      // dropdown in the correct direction and not concealed.
      /* eslint-disable react/no-did-update-set-state */
      this.setState({
        maxDropdownHeight,
        menuDirection,
        menuHeight
      });
      /* eslint-enable react/no-did-update-set-state */
    }
  }

  getOptimalMenuStyle(menuHeight) {
    let direction = 'down';
    let height = null;

    // If we don't know the menu height, render it down.
    if (menuHeight == null) {
      return {direction: 'down', height: null};
    }
    // Calculate the space above and below the dropdown button.
    let spaceAroundDropdown = DOMUtil
      .getNodeClearance(this.refs.dropdownWrapper);

    // If the menu height is larger than the space available on the bottom and
    // less than the space available on top, then render it up. Otherwise always
    // render down.
    if (menuHeight > spaceAroundDropdown.bottom
      && menuHeight < spaceAroundDropdown.top) {
      direction = 'up';
      height = spaceAroundDropdown.top;
    } else {
      direction = 'down';
      height = spaceAroundDropdown.bottom;
    }

    // We assume that 125 pixels is the smallest height we should render.
    if (height < 125) {
      height = 125;
    }

    return {direction, height};
  }

  getMenuItems(items) {
    let selectedID = this.getSelectedID();

    return items.map((item) => {
      let classSet = classNames(
        {
          'is-selectable': item.selectable !== false,
          'is-selected': item.id === selectedID
        },
        item.className,
        this.props.dropdownMenuListItemClassName
      );

      let handleUserClick = null;

      if (item.selectable !== false) {
        handleUserClick = this.handleItemClick.bind(this, item);
      }

      return (
        <li className={classSet} key={item.id} onClick={handleUserClick}>
          {item.html}
        </li>
      );
    });
  }

  getSelectedHtml(id, items) {
    let obj = Util.find(items, function (item) {
      return item.id === id;
    });

    if (obj != null) {
      return obj.selectedHtml || obj.html;
    }

    return null;
  }

  getSelectedID() {
    return this.props.persistentID || this.state.selectedID;
  }

  removeBlurTimeout() {
    if (this.currentBlurTimeout) {
      global.clearTimeout(this.currentBlurTimeout);
    }
  }

  handleExternalClick() {
    if (this.state.isOpen) {
      this.setState({
        isOpen: false
      });
    }
  }

  handleItemClick(item) {
    let props = this.props;
    props.onItemSelection(item);

    let newState = {isOpen: false};
    // Only set the selectedID if persistentID is not set
    if (!props.persistentID) {
      newState.selectedID = item.id;
    }

    this.setState(newState);
    this.removeBlurTimeout();
  }

  handleWrapperBlur() {
    this.removeBlurTimeout();

    this.currentBlurTimeout = setTimeout(() => {
      if (this.state.isOpen === true) {
        this.setState({isOpen: false});
      }
    }, 150);

    // We need to remove focus from the button to avoid this event firing again
    // when we open the dropdown
    global.focus();
  }

  handleMenuToggle(e) {
    e.stopPropagation();
    let menuDirection = this.state.menuDirection;
    let maxDropdownHeight = this.state.maxDropdownHeight;

    // If the menu isn't open, then we're about to open it and we need to
    // calculate the direction every time.
    if (!this.state.isOpen) {
      let menuStyle = this.getOptimalMenuStyle(this.state.menuHeight);
      menuDirection = menuStyle.direction;
      maxDropdownHeight = menuStyle.height;
    }

    this.removeBlurTimeout();
    this.setState({
      maxDropdownHeight,
      menuDirection,
      isOpen: !this.state.isOpen
    });
  }

  render() {
    // Set a key based on the menu height so that React knows to keep the
    // the DOM element around while we are measuring it.
    let props = this.props;
    let state = this.state;
    let dropdownKey = 'initial-render';
    let dropdownMenu = null;
    let dropdownMenuClassSet = classNames(
      state.menuDirection,
      props.dropdownMenuClassName
    );
    let dropdownMenuStyle;
    let dropdownStateClassSet = {
      'open': state.isOpen
    };
    let items = props.items;
    let transitionName =
      `${props.transitionName}-${state.menuDirection}`;
    let wrapperClassSet = classNames(
      state.menuDirection,
      dropdownStateClassSet,
      props.wrapperClassName
    );

    if (state.menuHeight != null) {
      dropdownKey = state.menuHeight;
    }

    if (state.isOpen) {
      let dropdownMenuItems = (
        <ul>
          {this.getMenuItems(props.items)}
        </ul>
      );

      // Render with Gemini scrollbar if the dropdown's height is constrainted.
      if (state.menuHeight >= state.maxDropdownHeight) {
        // Remove 30 pixels from the dropdown height to account for offset
        // positioning from the dropdown button.
        dropdownMenuStyle = {
          height: `${state.maxDropdownHeight - 30}px`
        };
        if (props.useGemini) {
          dropdownMenuItems = (
            <GeminiScrollbar
            autoshow={true}
            className="container-scrollable"
            style={dropdownMenuStyle}>
            {dropdownMenuItems}
            </GeminiScrollbar>
          );
        } else {
          dropdownMenuItems = (
            <div
              className="container-scrollable"
              style={dropdownMenuStyle}>
              {dropdownMenuItems}
            </div>
          );
        }
      }

      dropdownMenu = (
        <span className={dropdownMenuClassSet}
          role="menu" ref="dropdownMenu" key={dropdownKey}>
          <div className={props.dropdownMenuListClassName}>
            {dropdownMenuItems}
          </div>
        </span>
      );

      // If we don't know the menu's height, we render it invisibly and then
      // immediately measure its height in #componentDidUpdate, which will change
      // the state and trigger another render.
      if (state.menuHeight == null) {
        dropdownMenu = (
          <div className="dropdown-menu-concealer" ref="dropdownMenuConcealer">
            {dropdownMenu}
          </div>
        );
      }
    }

    if (props.transition) {
      dropdownMenu = (
        <ReactCSSTransitionGroup
          transitionName={transitionName}
          transitionEnterTimeout={props.transitionEnterTimeout}
          transitionLeaveTimeout={props.transitionLeaveTimeout}>
          {dropdownMenu}
        </ReactCSSTransitionGroup>
      );
    }

    let selectedID = this.getSelectedID();

    return (
      <span className={wrapperClassSet}
        tabIndex="1"
        onBlur={this.handleWrapperBlur}
        ref="dropdownWrapper">
        <button className={props.buttonClassName}
          onClick={this.handleMenuToggle}
          ref="button"
          type="button">
          {this.getSelectedHtml(selectedID, items)}
        </button>
        {dropdownMenu}
      </span>
    );
  }
}

Dropdown.defaultProps = {
  transition: false,
  transitionName: 'dropdown-menu',
  transitionEnterTimeout: 250,
  transitionLeaveTimeout: 250,
  onItemSelection: () => {},
  useGemini: true
};

Dropdown.propTypes = {
  // When set it will always set this property as the selected ID.
  // Notice: This property will override the initialID
  persistentID: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number
  ]),
  // The items to display in the dropdown.
  items: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      // An optional classname for the menu item.
      className: React.PropTypes.string,
      // A required ID for each item
      id: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.number
      ]).isRequired,
      // The HTML (or text) to render for the list item.
      html: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.object
      ]),
      // Whether or not the user can choose the item.
      selectable: React.PropTypes.bool,
      // The HTML (or text) to display when the option is selected. If this is
      // not provided, the value for the `html` property will be used.
      selectedHtml: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.object
      ])
    })
  ).isRequired,
  // The ID of the item that should be selected initially.
  initialID: React.PropTypes.oneOfType([
    React.PropTypes.string,
    React.PropTypes.number
  ]),
  // An optional callback when an item is selected. Will receive an argument
  // containing the selected item as it was supplied via the items array.
  onItemSelection: React.PropTypes.func,
  // Optional transition on the dropdown menu. Must be accompanied
  // by an animation or transition in CSS.
  transition: React.PropTypes.bool,
  // The prefix of the transition classnames.
  transitionName: React.PropTypes.string,
  // Transition lengths
  transitionEnterTimeout: React.PropTypes.number,
  transitionLeaveTimeout: React.PropTypes.number,
  // Option to use Gemini scrollbar. Defaults to true.
  useGemini: React.PropTypes.bool,

  // Classes:
  // Classname for the element that ther user interacts with to open menu.
  buttonClassName: React.PropTypes.string,
  // Classname for the dropdown menu wrapper.
  dropdownMenuClassName: React.PropTypes.string,
  // Classname for the dropdown list wrapper.
  dropdownMenuListClassName: React.PropTypes.string,
  // Classname for the dropdown list item.
  dropdownMenuListItemClassName: React.PropTypes.string,
  // Classname for the element that wraps the entire component.
  wrapperClassName: React.PropTypes.string
};

module.exports = Dropdown;
